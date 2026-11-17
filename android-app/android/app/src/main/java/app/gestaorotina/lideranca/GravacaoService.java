package app.gestaorotina.lideranca;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

/**
 * Mantém a gravação viva com a tela bloqueada ou com o app em segundo plano.
 * Sem um "serviço em primeiro plano" do tipo microfone, o Android pausa o app (e o microfone)
 * pouco depois de a tela apagar. Enquanto grava, fica um aviso fixo "Gravando" na barra do celular.
 */
public class GravacaoService extends Service {
    private static final String CANAL = "gravacao";
    private static final int ID = 7301;
    private PowerManager.WakeLock trava;

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        try {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm != null) {
                NotificationChannel c = new NotificationChannel(CANAL, "Gravação em andamento", NotificationManager.IMPORTANCE_LOW);
                c.setDescription("Aviso fixo enquanto o FlowFire grava");
                nm.createNotificationChannel(c);
            }
            Intent abrir = new Intent(this, MainActivity.class);
            abrir.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent pi = PendingIntent.getActivity(this, 0, abrir, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
            Notification.Builder b = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O ? new Notification.Builder(this, CANAL) : new Notification.Builder(this);
            Notification n = b.setContentTitle("FlowFire está gravando")
                .setContentText("Toque para abrir. A gravação continua com a tela apagada.")
                .setSmallIcon(R.drawable.ic_stat_notify)
                .setOngoing(true)
                .setContentIntent(pi)
                .build();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) startForeground(ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
            else startForeground(ID, n);
            if (trava == null) {
                PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
                if (pm != null) {
                    trava = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "flowfire:gravacao");
                    trava.setReferenceCounted(false);
                    trava.acquire(4 * 60 * 60 * 1000L);   // no máximo 4 h, por segurança
                }
            }
        } catch (Exception e) {
            // Sem permissão ou Android recusou: a gravação segue como antes (com a tela acesa)
            stopSelf();
        }
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        try { if (trava != null && trava.isHeld()) trava.release(); } catch (Exception e) { /* já solta */ }
        trava = null;
        super.onDestroy();
    }
}
