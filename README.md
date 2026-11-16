# PeScurt

Caiet digital în limba română pentru fotografii, PDF-uri și notițe. Interfața web este responsive. Serverul rulează pe Node.js 22 sau o versiune mai nouă și nu necesită instalarea unor pachete npm.

## Rulare locală

```bash
cp .env.example .env
npm run dev
npm test
```

Deschide <http://localhost:3000>. Paginile publice funcționează fără conturi externe. Pentru a folosi caietul și profilul ai nevoie de Supabase. Salvarea documentelor funcționează independent de procesarea AI și de abonamente.

## Supabase

1. Creează un proiect dedicat și rulează [supabase/schema.sql](supabase/schema.sql) o singură dată, în SQL Editor. Schema creează tabelele, operațiile de cotă și cele două bucketuri private.
2. Completează `SUPABASE_URL`, `SUPABASE_ANON_KEY` și `SUPABASE_SERVICE_ROLE_KEY` pe server. Cheia cu rol de serviciu nu trebuie expusă în browser, în GitHub sau în loguri.
3. Activează providerul Email, confirmarea adreselor și un SMTP de producție. Setează Site URL la adresa din `APP_URL`, fără slash final. Pentru dezvoltare și testare folosește un proiect Supabase separat cu Site URL local.
4. Configurează linkurile din șabloane. Pagina de confirmare cere o apăsare înainte de a consuma tokenul.
   - **Confirm signup:** `{{ .SiteURL }}/confirma?type=email&token_hash={{ .TokenHash }}`
   - **Reset password:** `{{ .SiteURL }}/confirma?type=recovery&token_hash={{ .TokenHash }}`
5. După ce administratorul își creează și confirmă contul, acordă dreptul folosind UUID-ul contului din Authentication → Users.

```sql
insert into public.admins (user_id) values ('UUID-UL-CONTULUI');
```

Administratorii intră în **Profil → Administrare verificări**. Acel rol permite descărcarea documentului justificativ, aprobarea, respingerea cu motiv și ștergerea fișierului. Aprobarea deblochează tariful redus. Planul devine activ după confirmarea plății.

`STUDENT_PROOF_RETENTION_DAYS` (implicit 30) se aplică cererilor noi. După termen, descărcarea se blochează imediat. Cronul Vercel încearcă zilnic să șteargă documentele expirate și închide cererile expirate încă nesoluționate. Configurează `CRON_SECRET` cu o valoare aleatorie puternică. Pentru alt host, apelează periodic `/api/jobs/student-retention` cu headerul `Authorization: Bearer <CRON_SECRET>`. Administratorul poate porni și manual operația. Decizia se păstrează separat de fișier.

## OpenAI și limite

Completează `OPENAI_API_KEY` și `OPENAI_MODEL` cu un model Responses API care acceptă imagini și PDF-uri. Aplicația trimite doar materialul de studiu la cererea utilizatorului. Documentele justificative rămân în fluxul de verificare manuală.

Fișiere acceptate: PDF, JPG, PNG și WebP, până la 3 MB. Limita zilnică se aplică pe cont, la prima procesare reușită a fiecărui document în ziua respectivă. Acțiunile suplimentare pentru același document în aceeași zi și consultarea rezultatelor salvate nu consumă un loc nou. Ștergerea unui document procesat nu recuperează locul. Fusul orar se setează prin `APP_TIME_ZONE` (implicit `Europe/Bucharest`).

## Stripe

1. Creează prețurile în RON în Stripe. Pagina afișează tarifele de mai jos și activează checkout-ul doar când ID-ul Stripe are aceeași monedă, sumă și perioadă. Pentru a schimba tarifele, actualizează [public/plans.js](public/plans.js) și setează ID-urile noilor prețuri Stripe.

   | Plan | Tarif | Variabilă pentru ID-ul Stripe |
   | --- | --- | --- |
   | Premium lunar | 30 lei pe lună | `STRIPE_MONTHLY_PRICE_ID` |
   | Premium anual | 300 lei pe an | `STRIPE_YEARLY_PRICE_ID` |
   | Elev/student lunar | 20 lei pe lună | `STRIPE_STUDENT_MONTHLY_PRICE_ID` |
   | Elev/student anual | 200 lei pe an | `STRIPE_STUDENT_YEARLY_PRICE_ID` |
   | Acces pe viață | 500 lei, plată unică | `STRIPE_LIFETIME_PRICE_ID` |

   `STRIPE_STUDENT_PRICE_ID` rămâne acceptat pentru recunoașterea abonamentelor existente și poate servi drept ID lunar dacă tariful său corespunde. Ambele opțiuni pentru elevi și studenți cer aceeași verificare înainte de plată.
2. Completează `STRIPE_SECRET_KEY` și variabilele `STRIPE_*_PRICE_ID`. Începe cu chei, prețuri și webhookuri de test.
3. Adaugă webhookul `https://pescurt.ro-mihaiu.xyz/api/billing/webhook` și setează secretul lui în `STRIPE_WEBHOOK_SECRET`. Abonează-l la:
   - `checkout.session.completed`, `checkout.session.async_payment_succeeded`
   - `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.paused`, `customer.subscription.resumed`
   - `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed`
4. Activează Stripe Customer Portal și anularea abonamentelor. Dezactivează schimbarea planurilor direct în portal, ca tariful de elev/student să rămână accesibil doar prin verificarea PeScurt.
5. Testează plata, actualizarea planului prin webhook și anularea înainte să treci la cheile de producție. Checkout-ul și portalul sunt găzduite de Stripe.

## Pagini legale

Paginile publice sunt `/termeni`, `/confidentialitate` și `/cookies`. Completează `LEGAL_OPERATOR_NAME`, `LEGAL_OPERATOR_ADDRESS`, `LEGAL_OPERATOR_REGISTRATION` (dacă se aplică) și `LEGAL_CONTACT_EMAIL`. Înainte de activarea plăților, verifică textele din [public/legal.js](public/legal.js) și completează detaliile despre furnizor, condițiile de retragere, termenele de păstrare și transferurile de date pentru serviciile configurate efectiv. Site-ul folosește cookie-uri de sesiune și recuperare a parolei.

## Publicare pe Bot-Hosting

Importă repository-ul ca aplicație Node.js 22+ și pornește-l cu `npm start` sau `server/local.js`. Alege în panou portul alocat și setează aceeași valoare în `PORT` dacă panoul nu o setează automat. Atașează domeniul în panou, aplică în Cloudflare înregistrările afișate și setează `APP_URL=https://pescurt.ro-mihaiu.xyz`. Cheile se setează prin variabilele de mediu ale aplicației. Pentru ștergerea automată a documentelor justificative expirate, configurează apelul periodic descris în secțiunea Supabase.

## Publicare pe Vercel

Importă repository-ul în Vercel ca proiect de tip **Other**, cu configurația din `vercel.json`. Adaugă variabilele de producție, inclusiv `APP_URL=https://pescurt.ro-mihaiu.xyz`. Atașează domeniul în setările proiectului Vercel și adaugă în Cloudflare înregistrarea DNS indicată acolo. Verifică accesul HTTPS și rulează fluxurile de cont, procesare și plată în mediul de test al fiecărui provider.

Documentație: [Supabase Auth](https://supabase.com/docs/guides/auth/auth-email-templates) · [OpenAI PDF inputs](https://developers.openai.com/api/docs/guides/file-inputs) · [Stripe Checkout](https://docs.stripe.com/checkout/fulfillment) · [Vercel domains](https://vercel.com/docs/domains/set-up-custom-domain).
