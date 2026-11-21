"""Configure the production Supabase Auth sender and code templates for PeScurt."""
import getpass
import json
import urllib.error
import urllib.request

PROJECT = "ejqhjefxyvgavoijejek"
SENDER = "pescurt.info@gmail.com"


def main():
    print(f"Expeditor PeScurt: {SENDER}")
    token = getpass.getpass("Token personal Supabase: ").strip()
    password = getpass.getpass("Parola de aplicație Gmail (16 litere): ").replace(" ", "")
    if not token or len(password) != 16:
        raise SystemExit("Verifică tokenul și parola de aplicație Gmail.")
    config = {
        "external_google_enabled": False,
        "external_email_enabled": True,
        "mailer_autoconfirm": False,
        "smtp_host": "smtp.gmail.com",
        "smtp_port": "587",
        "smtp_user": SENDER,
        "smtp_pass": password,
        "smtp_admin_email": SENDER,
        "smtp_sender_name": "PeScurt",
    }
    for template, subject in {
        "confirmation": "Confirmă adresa pentru PeScurt",
        "recovery": "Resetează parola PeScurt",
        "magic_link": "Codul tău de autentificare PeScurt",
    }.items():
        config["mailer_subjects_" + template] = subject
        config["mailer_templates_" + template + "_content"] = (
            "<h2>" + subject + "</h2><p>Introdu acest cod pe pagina PeScurt:</p>"
            "<p><strong>{{ .Token }}</strong></p>"
            "<p>Dacă nu ai cerut codul, poți ignora acest mesaj.</p>"
        )
    request = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{PROJECT}/config/auth",
        method="PATCH",
        headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"},
        data=json.dumps(config).encode(),
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            print("Configurație salvată. Cere un cod pe site și verifică primirea lui.")
    except urllib.error.HTTPError as exc:
        raise SystemExit(f"Supabase a refuzat configurarea (HTTP {exc.code}).")


if __name__ == "__main__":
    main()
