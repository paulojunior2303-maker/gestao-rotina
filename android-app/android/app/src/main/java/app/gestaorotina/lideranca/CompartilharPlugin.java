package app.gestaorotina.lideranca;

import android.content.ClipData;
import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.util.Base64;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.ArrayList;

/**
 * Recebe o que a pessoa compartilha com o FlowFire (WhatsApp → Compartilhar → FlowFire):
 * um ou vários áudios e/ou um texto. Os arquivos chegam ao app web em base64 pelo evento "recebido"
 * (guardado até o app web começar a ouvir, para funcionar também com o app fechado).
 */
@CapacitorPlugin(name = "Compartilhar")
public class CompartilharPlugin extends Plugin {
    private static final int MAX_BYTES = 25 * 1024 * 1024;   // por arquivo
    private JSObject pendente = null;

    @Override
    public void load() {
        if (getActivity() != null) ler(getActivity().getIntent(), true);
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        ler(intent, false);
    }

    private void ler(final Intent intent, final boolean inicio) {
        if (intent == null) return;
        final String acao = intent.getAction();
        if (!Intent.ACTION_SEND.equals(acao) && !Intent.ACTION_SEND_MULTIPLE.equals(acao)) return;
        final ArrayList<Uri> uris = new ArrayList<>();
        try {
            if (Intent.ACTION_SEND.equals(acao)) {
                Uri u = intent.getParcelableExtra(Intent.EXTRA_STREAM);
                if (u != null) uris.add(u);
            } else {
                ArrayList<Uri> l = intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
                if (l != null) uris.addAll(l);
            }
        } catch (Exception e) { /* extra num formato inesperado */ }
        ClipData clip = intent.getClipData();
        if (clip != null) {
            for (int i = 0; i < clip.getItemCount(); i++) {
                Uri u = clip.getItemAt(i).getUri();
                if (u != null && !uris.contains(u)) uris.add(u);
            }
        }
        final String texto = intent.getStringExtra(Intent.EXTRA_TEXT);
        final String assunto = intent.getStringExtra(Intent.EXTRA_SUBJECT);
        // não processa de novo se a tela girar ou o app voltar
        if (inicio && getActivity() != null) getActivity().setIntent(new Intent(Intent.ACTION_MAIN));
        new Thread(() -> {
            JSArray arquivos = new JSArray();
            ContentResolver cr = getContext().getContentResolver();
            for (Uri u : uris) {
                JSObject a = new JSObject();
                a.put("nome", nome(cr, u));
                String tipo = cr.getType(u);
                a.put("tipo", tipo == null ? "" : tipo);
                try (InputStream in = "content".equals(u.getScheme()) ? cr.openInputStream(u) : null) {
                    // Segurança: só lê o que o outro app entregou (content://). Um endereço file:// poderia apontar para arquivos internos do próprio FlowFire.
                    if (in == null) throw new Exception("sem conteúdo");
                    ByteArrayOutputStream out = new ByteArrayOutputStream();
                    byte[] buf = new byte[65536];
                    int n, total = 0;
                    while ((n = in.read(buf)) > 0) {
                        total += n;
                        if (total > MAX_BYTES) throw new Exception("grande demais");
                        out.write(buf, 0, n);
                    }
                    a.put("tamanho", total);
                    a.put("dados", Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP));
                } catch (Exception e) {
                    a.put("erro", e.getMessage() == null ? "erro" : e.getMessage());
                }
                arquivos.put(a);
            }
            JSObject r = new JSObject();
            r.put("id", System.currentTimeMillis());
            r.put("arquivos", arquivos);
            r.put("texto", texto == null ? "" : texto);
            r.put("assunto", assunto == null ? "" : assunto);
            pendente = r;
            notifyListeners("recebido", r, true);
        }).start();
    }

    private String nome(ContentResolver cr, Uri u) {
        try (Cursor c = cr.query(u, new String[] { OpenableColumns.DISPLAY_NAME }, null, null, null)) {
            if (c != null && c.moveToFirst()) {
                String n = c.getString(0);
                if (n != null) return n;
            }
        } catch (Exception e) { /* sem nome */ }
        String s = u.getLastPathSegment();
        return s == null ? "audio" : s;
    }

    /** O que chegou e ainda não foi lido pelo app web (reserva caso o evento se perca). */
    @PluginMethod
    public void pendentes(PluginCall call) {
        JSObject r = pendente != null ? pendente : new JSObject();
        pendente = null;
        call.resolve(r);
    }

    /** O app web avisa que já tratou o que chegou. */
    @PluginMethod
    public void limpar(PluginCall call) {
        pendente = null;
        call.resolve();
    }
}
