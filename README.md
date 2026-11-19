# PeScurt

Caiet digital în limba română pentru fotografii, PDF-uri și notițe. Interfața web este responsive. Serverul rulează pe Node.js 22 sau o versiune mai nouă și nu necesită instalarea unor pachete npm.

## Rulare locală

```bash
cp .env.example .env
npm run dev
npm test
```

Deschide <http://localhost:3000>. Paginile publice funcționează fără conturi externe. Pentru a folosi caietul și profilul ai nevoie de Supabase. Salvarea documentelor funcționează independent de procesarea AI.

## Supabase

1. Creează un proiect dedicat și rulează [supabase/schema.sql](supabase/schema.sql) o singură dată, în SQL Editor. Schema creează tabelele, operațiile de cotă și cele două bucketuri private.
2. Completează `SUPABASE_URL`, `SUPABASE_ANON_KEY` și `SUPABASE_SERVICE_ROLE_KEY` pe server. Cheia cu rol de serviciu nu trebuie expusă în browser, în GitHub sau în loguri.
3. Activează providerul Email, confirmarea adreselor și un SMTP de producție. Setează Site URL la adresa din `APP_URL`, fără slash final. Pentru dezvoltare și testare folosește un proiect Supabase separat cu Site URL local.
4. Configurează linkurile din șabloane. Pagina de confirmare cere o apăsare înainte de a consuma tokenul.
   - **Confirm signup:** `{{ .SiteURL }}/confirma?type=email&token_hash={{ .TokenHash }}`
   - **Reset password:** `{{ .SiteURL }}/confirma?type=recovery&token_hash={{ .TokenHash }}`
Cererile de verificare trimise înainte de dezactivarea funcției rămân în stocare privată. `STUDENT_PROOF_RETENTION_DAYS` (implicit 30) se aplică cererilor existente; cronul Vercel șterge automat documentele expirate. Pentru alt host, configurează un apel periodic la `/api/jobs/student-retention` cu headerul `Authorization: Bearer <CRON_SECRET>`.

## OpenAI și limite

Completează `OPENAI_API_KEY` și `OPENAI_MODEL` cu un model Responses API care acceptă imagini și PDF-uri. Aplicația trimite doar materialul de studiu la cererea utilizatorului. 

Fișiere acceptate: PDF, JPG, PNG și WebP, până la 3 MB. Limita zilnică se aplică pe cont, la prima procesare reușită a fiecărui document în ziua respectivă. Acțiunile suplimentare pentru același document în aceeași zi și consultarea rezultatelor salvate nu consumă un loc nou. Ștergerea unui document procesat nu recuperează locul. Fusul orar se setează prin `APP_TIME_ZONE` (implicit `Europe/Bucharest`).

## Donații

PeScurt este gratuit și permite procesarea a maximum 2 documente pe zi pentru fiecare cont. Dacă vrei să susții proiectul, poți face o donație sau poți vedea produsele disponibile în magazinul Ko-fi: <https://ko-fi.com/ro_mihaiu>. Donațiile sunt voluntare și nu schimbă limita sau funcțiile contului. Plățile donațiilor sunt gestionate direct de Ko-fi; PeScurt nu colectează și nu stochează date de card.

## Pagini legale

Paginile publice sunt `/termeni`, `/confidentialitate` și `/cookies`. Completează `LEGAL_OPERATOR_NAME`, `LEGAL_OPERATOR_ADDRESS`, `LEGAL_OPERATOR_REGISTRATION` (dacă se aplică) și `LEGAL_CONTACT_EMAIL`. Verifică textele din [public/legal.js](public/legal.js) și completează detaliile operatorului și informațiile despre serviciile configurate efectiv. Site-ul folosește cookie-uri de sesiune și recuperare a parolei.

## Publicare pe Bot-Hosting

Importă repository-ul ca aplicație Node.js 22+ și pornește-l cu `npm start` sau `server/local.js`. Alege în panou portul alocat și setează aceeași valoare în `PORT` dacă panoul nu o setează automat. Atașează domeniul în panou, aplică în Cloudflare înregistrările afișate și setează `APP_URL=https://pescurt.ro-mihaiu.xyz`. Cheile se setează prin variabilele de mediu ale aplicației. Pentru ștergerea automată a documentelor justificative expirate, configurează apelul periodic descris în secțiunea Supabase.

## Hosting

PeScurt folosește Node.js API routes, Supabase și stocare externă. Vercel se potrivește implementării actuale și păstrează accesul la funcții fără pornire la rece după inactivitate. Render Free poate găzdui un serviciu Node, dar îl oprește după 15 minute fără trafic; prima cerere ulterioară poate aștepta aproximativ un minut. Sistemul de fișiere este temporar, iar aplicația trebuie să continue să folosească Supabase pentru documente. Pentru un site accesibil fără întârziere, păstrează Vercel sau folosește un plan Render plătit.

## Publicare pe Vercel

Importă repository-ul în Vercel ca proiect de tip **Other**, cu configurația din `vercel.json`. Adaugă variabilele de producție, inclusiv `APP_URL=https://pescurt.ro-mihaiu.xyz`. Atașează domeniul în setările proiectului Vercel și adaugă în Cloudflare înregistrarea DNS indicată acolo. Verifică accesul HTTPS și fluxurile de cont și documente.

Documentație: [Supabase Auth](https://supabase.com/docs/guides/auth/auth-email-templates) · [OpenAI PDF inputs](https://developers.openai.com/api/docs/guides/file-inputs) · [Vercel domains](https://vercel.com/docs/domains/set-up-custom-domain) · [Render Free](https://render.com/docs/free).
