package app.gestaorotina.lideranca;

import android.content.Context;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Abre o diálogo de impressão do Android para um HTML (permite "Salvar como PDF"). */
@CapacitorPlugin(name = "Printer")
public class PrinterPlugin extends Plugin {
    private WebView printView; // mantém a referência até a impressão terminar

    @PluginMethod
    public void print(PluginCall call) {
        final String html = call.getString("html");
        final String name = call.getString("name", "Relatorio");
        if (html == null) { call.reject("HTML ausente"); return; }
        getActivity().runOnUiThread(() -> {
            WebView wv = new WebView(getContext());
            wv.setWebViewClient(new WebViewClient() {
                private boolean done = false;
                @Override
                public void onPageFinished(WebView view, String url) {
                    if (done) return;
                    done = true;
                    PrintManager pm = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
                    PrintDocumentAdapter adapter = view.createPrintDocumentAdapter(name);
                    pm.print(name, adapter, new PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4).build());
                    call.resolve();
                }
            });
            printView = wv;
            wv.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null);
        });
    }
}
