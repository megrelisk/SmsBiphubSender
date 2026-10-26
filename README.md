# SmsBiphubSender

ლოკალური ვებ-ინტერფეისი SMS-ების გასაგზავნად [Beephub SMS API v2](https://beephub.ge/docs)-ით.

- ერთი ან რამდენიმე ნომრის გაგზავნა, მასობრივი გაგზავნა CSV/Excel-იდან
- შაბლონები და ცვლადები (`{{name}}` — სვეტის სახელი ფაილიდან)
- დაგეგმვა კონკრეტულ დღეზე და საათზე
- ისტორია და სტატუსები (ავტომატურად ახლდება)
- სტატუსის შემოწმება და ავტომატური ხელახალი ცდა: მაქსიმუმ 3 ცდა, პაუზები 1 და 5 წუთი

## გაშვება

საჭიროა Node.js 20+ და PostgreSQL (13+).

```bash
createdb smssender
cp server/.env.example server/.env   # შეავსეთ DATABASE_URL და BEEPHUB_API_KEY, BEEPHUB_MOCK=0
npm install
npm run build
npm start                            # http://localhost:3001
```

დეველოპმენტისთვის: `npm run dev:server` და `npm run dev:client` (http://localhost:5173).
`BEEPHUB_MOCK=1` რეჟიმში SMS რეალურად არ იგზავნება. ნომრის ბოლო ციფრი განსაზღვრავს სცენარს:
`0` — დროებითი მიწოდების შეცდომა, `9` — მუდმივი, `8` — არასწორი ნომერი, `7` — პირველად HTTP 500, დანარჩენი — წარმატება.

## დუბლირებისგან დაცვა

- ყოველ მესიჯს აქვს უნიკალური UUID, რომელიც იგზავნება როგორც `clientMessageId`.
- `clientReference` = `<UUID>-s<მოთხოვნის ნომერი>`. თუ პასუხი არ მივიდა (timeout), მოთხოვნა **იგივე** reference-ით მეორდება
  და Beephub-ის idempotency დუბლს არ დაუშვებს. თუ პასუხი კვლავ გაურკვეველია, ან მოდის 409, მესიჯი ხდება
  `NEEDS_REVIEW` და ავტომატურად აღარ იგზავნება.
- ნომრები ერთ გაგზავნაში უნიკალურია (`UNIQUE (campaign_id, to_number)`).

## შეცდომების კლასიფიკაცია ([server/src/errors.js](server/src/errors.js))

| ტიპი | მაგალითი | ქცევა |
|---|---|---|
| მუდმივი | `INVALID_PHONE_NUMBER`, `VALIDATION_FAILED`, `retryable=false`, `FAILED` არასწორი ნომრის მიზეზით | ხელახლა არ იგზავნება |
| დროებითი | HTTP 5xx, `EXPIRED`, `FAILED` უცნობი მიზეზით | მაქს. 3 ცდა, შემდეგ `FAILED_FINAL` (ხელით ხელახლა ცდა შესაძლებელია) |
| პარამეტრები | `AUTH_INVALID`, `AUTH_FORBIDDEN` | ცდა არ იხარჯება, 5 წუთში თავიდან |
| ლიმიტი | `RATE_LIMITED` | ცდა არ იხარჯება, `Retry-After`-ის მერე თავიდან |

> `failureReason`-ის შესაძლო მნიშვნელობები დოკუმენტაციაში არ არის ჩამოთვლილი. რეალური მნიშვნელობების ნახვის შემდეგ
> დააზუსტეთ `PERMANENT_FAILURE_RE` `errors.js`-ში.
