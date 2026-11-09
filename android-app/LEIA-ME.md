# Gestão de Rotina — app Android

## Instalar no celular
1. Baixe o APK mais recente em Releases (link abaixo) e copie para o celular (WhatsApp, Drive, cabo USB…).
2. Toque no arquivo. Na primeira vez, o Android pede para **permitir instalar apps desta fonte**
   (Configurações → Instalar apps desconhecidos → autorizar o app usado para abrir o arquivo).
3. Se o Play Protect avisar “app não reconhecido”, toque em **Mais detalhes → Instalar mesmo assim**.
   O aviso aparece porque o app não está na Play Store, não porque há algo errado com ele.

## Dados
- Os dados ficam **no próprio celular**: são salvos na WebView do app e numa cópia interna (`gestao-rotina-dados.json`).
- Desinstalar o app **apaga os dados**. Antes, use Configurações → Exportar backup.
- Exportações (Excel, backup) abrem o menu **Compartilhar** do Android: Drive, Arquivos, WhatsApp, e-mail…
- O botão PDF abre a **impressão do Android**: escolha “Salvar como PDF”.

## Chave de assinatura — guarde com cuidado
`keystore/gestao-rotina.jks` (senhas em `keystore/keystore.properties`) é a chave que assina o app.
**Toda versão futura precisa ser assinada com esta mesma chave.** Só assim ela instala por cima da atual e mantém os dados.
Se a chave se perder, uma nova versão exigirá desinstalar a anterior, o que apaga os dados (faça backup antes).

## Gerar o APK

**Automático (GitHub Actions):** a cada alteração no app enviada para `main`, o workflow
`.github/workflows/android-apk.yml` gera o APK assinado e publica em **Releases**.
Link fixo para baixar a versão mais recente:
https://github.com/paulojunior2303-maker/gestao-rotina/releases/latest/download/GestaoRotina.apk

A chave fica nos *secrets* do repositório (`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`,
`ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`). Ela **nunca** é versionada.

**Manual:** Node.js 20+, JDK 21 e Android SDK (platform 36 / build-tools 35). Coloque a chave em `android-app/keystore/`
(`gestao-rotina.jks` + `keystore.properties`) e, na raiz do repositório:
```bash
python3 build.py
mkdir -p android-app/www && cp dist/gestao-rotina.html android-app/www/index.html
cd android-app && npm ci && npx cap sync android
cd android && ./gradlew assembleRelease
```
Partes nativas próprias: `android/app/src/main/java/app/gestaorotina/lideranca/PrinterPlugin.java`
(impressão/PDF) e o registro em `MainActivity.java`. O restante é o mesmo app web da raiz do repositório.
