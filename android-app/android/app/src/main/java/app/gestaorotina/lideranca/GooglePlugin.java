package app.gestaorotina.lideranca;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.IntentSender;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.common.api.Scope;
import java.util.ArrayList;
import java.util.List;

/**
 * Autorização do Google (conta do aparelho) para o app acessar o Google Drive.
 * Usa o AuthorizationClient oficial: na primeira vez mostra a tela de escolha de conta e permissão;
 * depois devolve o token sem perguntar nada (interativo = false).
 * O cliente OAuth "Android" (pacote + SHA-1 da chave de assinatura) fica no Google Cloud do usuário.
 */
@CapacitorPlugin(name = "Google", requestCodes = { GooglePlugin.REQ })
public class GooglePlugin extends Plugin {
    static final int REQ = 7701;
    private PluginCall pendente;

    @PluginMethod
    public void autorizar(PluginCall call) {
        final boolean interativo = Boolean.TRUE.equals(call.getBoolean("interativo", false));
        List<Scope> escopos = new ArrayList<>();
        try {
            JSArray arr = call.getArray("escopos");
            for (Object o : arr.toList()) escopos.add(new Scope(String.valueOf(o)));
        } catch (Exception e) {
            call.reject("Escopos inválidos");
            return;
        }
        AuthorizationRequest req = AuthorizationRequest.builder().setRequestedScopes(escopos).build();
        Identity.getAuthorizationClient(getActivity()).authorize(req)
            .addOnSuccessListener(result -> {
                if (result.hasResolution()) {
                    if (!interativo) { call.reject("É preciso autorizar o Google Drive", "PRECISA_AUTORIZAR"); return; }
                    PendingIntent pi = result.getPendingIntent();
                    if (pi == null) { call.reject("O Google não abriu a tela de autorização"); return; }
                    try {
                        pendente = call;
                        getActivity().startIntentSenderForResult(pi.getIntentSender(), REQ, null, 0, 0, 0);
                    } catch (IntentSender.SendIntentException e) {
                        pendente = null;
                        call.reject("Falha ao abrir a autorização: " + e.getMessage());
                    }
                } else {
                    responder(call, result);
                }
            })
            .addOnFailureListener(e -> call.reject("Falha na autorização do Google: " + e.getMessage()));
    }

    private void responder(PluginCall call, AuthorizationResult r) {
        JSObject o = new JSObject();
        o.put("accessToken", r.getAccessToken());
        o.put("escopos", new JSArray(r.getGrantedScopes()));
        call.resolve(o);
    }

    @Override
    protected void handleOnActivityResult(int requestCode, int resultCode, Intent data) {
        super.handleOnActivityResult(requestCode, resultCode, data);
        if (requestCode != REQ || pendente == null) return;
        PluginCall call = pendente;
        pendente = null;
        if (resultCode != Activity.RESULT_OK) { call.reject("Autorização cancelada", "CANCELADO"); return; }
        try {
            AuthorizationResult r = Identity.getAuthorizationClient(getActivity()).getAuthorizationResultFromIntent(data);
            responder(call, r);
        } catch (ApiException e) {
            call.reject("Autorização não concluída (" + e.getStatusCode() + "): " + e.getMessage());
        }
    }
}
