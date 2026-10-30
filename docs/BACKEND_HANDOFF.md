# ბექენდის გამოქვეყნების ინსტრუქცია დეველოპერისთვის

რეპო: https://github.com/megrelisk/SmsBiphubSender (ბრენჩი `main`)

## 1. რა არსებობს უკვე

| ნაწილი | სად | სტატუსი |
|---|---|---|
| ინტერფეისი (React + Vite) | `client/` | მზადაა. ონლაინ ვერსია: https://sms.sosokartozia.com (Firebase Hosting, საიტი `sms-sosokartozia`) |
| ბექენდი (Node 20+, Express, PostgreSQL) | `server/` | მზადაა და ლოკალურად მუშაობს, **ინტერნეტში არ არის გამოქვეყნებული** |
| ფონური გაგზავნა | `server/src/worker.js` | ბექენდის პროცესშია (`setInterval`, 3 წამში ერთხელ) |
| Beephub SMS API v2 კლიენტი | `server/src/beephub.js` | მზადაა (`BEEPHUB_MOCK=1` რეჟიმში იმიტაციაა) |
| MCP სერვერი Claude-ისთვის | `mcp/` | ლოკალურ ბექენდს უკავშირდება |

ონლაინ ინტერფეისი ახლა **დემო რეჟიმშია** (`client/.env.firebase` → `VITE_DEMO=1`): მონაცემები ბრაუზერის მეხსიერებაშია,
ბექენდს არ იძახებს და SMS არ იგზავნება. რეალური ბექენდის ჩართვისას ეს ხაზი უნდა წაიშალოს (იხ. §5).

## 2. რა უნდა გააკეთო (მოკლედ)

1. ბექენდი გაიტანე ინტერნეტში (რეკომენდაცია: **Cloud Run** + PostgreSQL, იხ. §3).
2. `https://sms.sosokartozia.com/api/**` გადაამისამართე ბექენდზე (Firebase Hosting rewrite, §4).
3. **ბექენდში დაამატე ავტორიზაცია** (§6). ეს აუცილებელია, სანამ ბექენდი საჯარო გახდება: ახლა API-ს არანაირი დაცვა არ აქვს და
   ნებისმიერს შეეძლება გააგზავნოს SMS ჩვენი ფულით.
4. ჩართე რეალური Beephub (`BEEPHUB_API_KEY`, `BEEPHUB_MOCK=0`) და გაუშვი ტესტი trial ნომრებზე (§7).
5. გამორთე ინტერფეისში დემო რეჟიმი და თავიდან გამოაქვეყნე (§5).

## 3. არქიტექტურა და ჰოსტინგი

- ინტერფეისი რჩება Firebase Hosting-ზე (დომენი `sms.sosokartozia.com` უკვე მიბმულია).
- ბექენდი: **Cloud Run** (ან VPS). PostgreSQL: Cloud SQL ან სხვა მართვადი PostgreSQL 13+ (სქემა `server/src/schema.sql`,
  ეშვება თავისით სერვერის გაშვებისას, `CREATE ... IF NOT EXISTS`).
- **მნიშვნელოვანი:** ფონური გაგზავნა და სტატუსების შემოწმება ბექენდის პროცესშია. Cloud Run-ზე ჩართე `min-instances=1` და
  „CPU always allocated“, თორემ პროცესი „დაიძინებს“ და დაგეგმილი SMS-ები დროზე არ გაიგზავნება. (ერთზე მეტი ასლი უსაფრთხოა:
  რიგი `FOR UPDATE SKIP LOCKED`-ით იკეტება.) ალტერნატივა: worker-ის გამოყოფა ცალკე სერვისად/Cloud Run Job-ად.
- **Beephub IP whitelisting:** Beephub-ს შეუძლია API გასაღები კონკრეტულ IP-ებს მიაბას (სხვა IP-დან მოთხოვნას 403 ეძლევა). Cloud Run-ის გამავალი IP
  დინამიურია, ამიტომ თუ whitelisting ჩაირთვება, საჭიროა სტატიკური გამავალი IP (VPC connector + Cloud NAT).
- არ გამოიყენო App Hosting: ის Next.js/Angular-ისთვისაა, ბაზას არ აგვარებს და დომენი ერთდროულად ორ პროდუქტზე ვერ იქნება.

## 4. `/api` გადამისამართება (ერთი წესი firebase.json-ში)

```json
{
  "hosting": {
    "site": "sms-sosokartozia",
    "public": "client/dist-web",
    "rewrites": [
      { "source": "/api/**", "run": { "serviceId": "sms-backend", "region": "europe-west1" } },
      { "source": "**", "destination": "/index.html" }
    ]
  }
}
```

ასე ინტერფეისი და ბექენდი ერთ მისამართზეა (`sms.sosokartozia.com`), CORS არ დაგჭირდება. ინტერფეისი უკვე `/api/...`-ს იძახებს
(`client/src/api.js`). გამოქვეყნება: `npm run build:web -w client` და `npx firebase-tools deploy --only hosting`.
Firebase პროექტი: `sosokartoziacom` (ძირითადი საიტის `sosokartozia.com` გამოქვეყნებას არ შეეხო, ეს ცალკე საიტია).
Hosting-ის rewrite-ს Cloud Run-ზე მოთხოვნის ლიმიტი 60 წამია, ეს ჩვენთვის საკმარისია.

## 5. გარემოს ცვლადები

ბექენდი (`server/.env.example` არის შაბლონი):

| ცვლადი | აღწერა |
|---|---|
| `PORT` | სერვერის პორტი (Cloud Run-ზე `PORT` თავად მოდის) |
| `DATABASE_URL` | PostgreSQL მისამართი |
| `BEEPHUB_API_KEY` | Beephub გასაღები. **საიდუმლოა**: Secret Manager, არა კოდი/რეპო |
| `BEEPHUB_BASE_URL` | `https://sms-api.beephub.ge` |
| `BEEPHUB_MOCK` | `0` პროდაქშენში (`1` = იმიტაცია, SMS არ იგზავნება) |
| `MAX_ATTEMPTS`, `RETRY_DELAYS_SEC`, `POLL_INTERVAL_SEC`, `TTL_SECONDS` | ხელახალი ცდები და სტატუსის შემოწმება |

ახლა სერვერი `127.0.0.1`-ზე უსმენს (`server/src/index.js`): Cloud Run-ზე ჩაანაცვლე `0.0.0.0`-ით (ან გარემოს ცვლადით).

ინტერფეისი: ონლაინ build-ის კონფიგურაცია არის `client/.env.firebase` (Firebase საჯარო კონფიგი, თეთრი სია `VITE_ALLOWED_EMAILS`
და **`VITE_DEMO=1`**). ბექენდის ჩართვისას წაშალე `VITE_DEMO=1` და თავიდან გამოაქვეყნე. ლოკალური `npm run build` დემოს არ იყენებს.

## 6. ავტორიზაცია (აუცილებელია)

ახლა Google შესვლა მხოლოდ ინტერფეისშია (`client/src/AuthGate.jsx`, Firebase Authentication, თეთრი სია `VITE_ALLOWED_EMAILS`).
ეს ბექენდს **არ იცავს**. საჭიროა:

1. ინტერფეისმა ყოველ `/api` მოთხოვნას დაურთოს `Authorization: Bearer <Firebase ID token>`
   (`auth.currentUser.getIdToken()`, ცვლილება ერთ ადგილას: `client/src/api.js`, ფუნქცია `request`).
2. ბექენდში middleware ყველა `/api` მარშრუტზე: `firebase-admin` → `verifyIdToken(token)`, შემდეგ შეამოწმოს
   `email_verified === true` და რომ მეილი ბექენდის თეთრ სიაშია (`ALLOWED_EMAILS` გარემოს ცვლადი, მძიმით გამოყოფილი).
   Firebase პროექტი: `sosokartoziacom`. არასწორი ან ვადაგასული token → `401`, მეილი სიაში არ არის → `403`.
3. მიმდინარე თეთრი სია: `kartoziasoso@gmail.com`, `megrelisk@gmail.com`, `aleksandre.gabunia@gmail.com`, `tatia.kartozia@gmail.com`,
   `khatia.mikava.1@gmail.com`. ისინი ბექენდის `ALLOWED_EMAILS`-შიც უნდა იყოს (სასურველია ერთი წყარო).
4. **MCP სერვერი** (`mcp/index.js`) ლოკალურად ავტორიზაციის გარეშე ეძახის API-ს. ბექენდის დაცვის შემდეგ მას ცალკე სერვისული
   გასაღები (მაგ. `X-Api-Key` ან სერვისული ანგარიშის token) დასჭირდება, ან დარჩეს მხოლოდ ლოკალურ ბექენდზე.
5. სასურველია: rate limit (`express-rate-limit`) `POST /api/campaigns`-ზე და ყველა გაგზავნის ჩანაწერი (ვინ გააგზავნა) ბაზაში.

## 7. Beephub

- API v2: https://beephub.ge/docs (გაგზავნა `POST /api/v2/sms:send`, სტატუსი `GET /api/v2/sms/{messageId}`).
- **Sender ID-ები** (უნდა იყოს Beephub-ში რეგისტრირებული ანგარიშზე): `KEA Academy`, `Mind up`, `Move Summit`, `Trainup.ge`.
  ისინი ბაზის ცხრილშია `cabinets` (ველი `sender`); ახალი კაბინეტის დასამატებლად `server/src/schema.sql`-ში ჩაამატე ჩანაწერი.
- **ბალანსის API არ არსებობს.** ბალანსი და ფასი 1 SMS-ზე ხელით შეჰყავს ინტერფეისში, ყოველი მიღებული მესიჯისას ბაზაში
  ავტომატურად აკლდება (`fragments × price`). თუ Beephub-ს ბალანსის endpoint-ს გაუხსნით, ეს ჩანაცვლდეს.
- Free trial: მხოლოდ კონფიგურირებულ trial ნომრებზე (მაქს. 10), 100 უფასო მესიჯი. ამით გაუშვი პირველი ტესტი.
- `failureReason`-ის შესაძლო მნიშვნელობები დოკუმენტაციაში არ არის ჩამოთვლილი. „მუდმივი“ მიზეზების სია არის სავარაუდო
  (`server/src/errors.js`, `PERMANENT_FAILURE_RE`). პირველი რეალური შეცდომების შემდეგ დააზუსტე.
- მარკეტინგული SMS-ისთვის ტექსტში „NO SMS“ ნომერი უნდა ეწეროს (Beephub-ის წესი, პერსონალურ მონაცემთა კანონი).

## 8. გაგზავნის ლოგიკა (რაც ბექენდს უკვე აქვს)

- გაგზავნა ორ ეტაპადაა: `POST /api/campaigns/preview` (არაფერი იგზავნება, ბრუნდება ღირებულება და მაგალითი), შემდეგ
  `POST /api/campaigns` (ქმნის გაგზავნას; მესიჯები რიგში ჩადის).
- ყოველ მესიჯს აქვს უნიკალური UUID (`clientMessageId`), `clientReference = <UUID>-s<ნომერი>`. თუ პასუხი არ მოვიდა (timeout), იგივე
  reference-ით მეორდება, Beephub-ის idempotency დუბლს არ გაატარებს. გაურკვეველი შედეგი → `NEEDS_REVIEW`, ავტომატურად აღარ იგზავნება.
- შეცდომები: **მუდმივი** (არასწორი ნომერი...) ხელახლა არ იგზავნება; **დროებითი** (5xx, EXPIRED...) მაქს. 3 ცდა (1 და 5 წუთის პაუზით);
  **CONFIG** (`AUTH_*`) და **THROTTLED** (`RATE_LIMITED`) ცდას არ ხარჯავს.
- შავი სია: `blocked_numbers` ცხრილი, ყველა კაბინეტისთვის საერთო.
- ფრაგმენტები: GSM-7 160/153, ქართული (UCS-2) 70/67, მაქს. 10 (`server/src/gsm.js`).

## 9. API (მოკლე სია)

ყველა მარშრუტი `/api`-ის ქვეშაა; კოდი: `server/src/routes.js`.

`GET /config` · `GET /cabinets`, `PUT /cabinets/:id` · `GET /stats?cabinet=` ·
`GET|POST|DELETE /blocked` · `GET|POST|PUT|DELETE /templates`, `PATCH /templates/:id/folder` ·
`GET|POST|DELETE /template-folders` · `POST /parse` (CSV/Excel) · `POST /campaigns/preview`, `POST /campaigns`,
`GET /campaigns`, `GET /campaigns/:id`, `POST /campaigns/:id/cancel`, `POST /campaigns/:id/retry-failed` · `GET /messages`.

## 10. გაშვება ლოკალურად

```bash
createdb smssender
cp server/.env.example server/.env   # BEEPHUB_MOCK=1 ტესტისთვის
npm install
npm run build
npm start                            # http://localhost:3001
```

ტესტები: `npm test -w server`. დეტალები: [README.md](../README.md).

> Windows PowerShell-ში `npm`-ის ნაცვლად გამოიყენე `npm.cmd` (სკრიპტების გაშვება შეიძლება აკრძალული იყოს).
