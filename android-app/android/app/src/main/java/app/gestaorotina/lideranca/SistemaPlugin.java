package app.gestaorotina.lideranca;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import android.view.WindowManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Atalhos para as telas do Android que deixam os lembretes tocarem com o app fechado:
 * economia de bateria, inicialização automática (Xiaomi/MIUI/HyperOS) e detalhes do app.
 */
@CapacitorPlugin(name = "Sistema")
public class SistemaPlugin extends Plugin {

    @PluginMethod
    public void status(PluginCall call) {
        JSObject r = new JSObject();
        boolean semRestricao = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
            semRestricao = pm != null && pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
        }
        r.put("bateriaLiberada", semRestricao);
        r.put("fabricante", Build.MANUFACTURER == null ? "" : Build.MANUFACTURER.toLowerCase());
        call.resolve(r);
    }

    @PluginMethod
    public void abrir(PluginCall call) {
        String tela = call.getString("tela", "app");
        Context ctx = getContext();
        String pkg = ctx.getPackageName();
        Intent i = null;
        if ("bateria".equals(tela) && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + pkg));
        } else if ("autostart".equals(tela)) {
            i = new Intent();
            i.setComponent(new ComponentName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"));
        }
        if (i == null || !tentar(i)) {
            Intent det = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + pkg));
            if (!tentar(det)) { call.reject("Não foi possível abrir as configurações"); return; }
        }
        call.resolve();
    }

    /** Mantém a tela acesa durante a gravação da reunião (senão o Android pode pausar o microfone). */
    @PluginMethod
    public void manterTela(PluginCall call) {
        final boolean ligada = Boolean.TRUE.equals(call.getBoolean("ligada", false));
        getActivity().runOnUiThread(() -> {
            if (ligada) getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            else getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        });
        call.resolve();
    }

    private boolean tentar(Intent i) {
        try {
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(i);
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
