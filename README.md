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

> დეველოპერისთვის: ბექენდის გამოქვეყნების ინსტრუქცია არის [docs/BACKEND_HANDOFF.md](docs/BACKEND_HANDOFF.md).

## კაბინეტები, ბალანსი, შაბლონები

- მარჯვენა ზედა გადამრთველით ირჩევ კაბინეტს (**KEA Academy** / **Mind up**). გაგზავნის სახელი (Sender ID) მოდის
  არჩეული კაბინეტიდან და ყველგან ჩანს (ფერადი ზოლი და გაგზავნის ღილაკი). Sender ID-ები ბაზის ცხრილშია (`cabinets`).
- შაბლონები კაბინეტზეა მიბმული. სატესტო შაბლონების ჩასაწერად: `npm.cmd run seed -w server`.
- Beephub-ის API ბალანსს არ აბრუნებს, ამიტომ ბალანსი და ფასი 1 SMS-ზე ხელით შეგყავს („ბალანსის შეცვლა“), გაგზავნილი
  მესიჯების ღირებულება კი (fragment-ები × ფასი) ავტომატურად აკლდება. fragment: GSM-7 160/153, ქართული (UCS-2) 70/67.

## MCP (გაგზავნა Claude-ის ჩატიდან)

[mcp/index.js](mcp/index.js) აძლევს Claude-ს ხელსაწყოებს: `list_cabinets`, `list_templates`, `send_sms`, `get_status`.
`send_sms` ჯერ გადახედვას აბრუნებს (`confirm=false`), რეალურად კი მხოლოდ `confirm=true`-ზე აგზავნის.
MCP-ს მუშაობისთვის აპლიკაცია (`npm.cmd start`) ჩართული უნდა იყოს.

Claude Desktop-ისთვის დაამატე `claude_desktop_config.json`-ში (და გადატვირთე Claude):

```json
{ "mcpServers": { "sms-biphub": { "command": "node", "args": ["C:\\Users\\User\\SmsBiphubSender\\mcp\\index.js"] } } }
```

Claude Code-ისთვის: `claude mcp add sms-biphub -- node C:\Users\User\SmsBiphubSender\mcp\index.js`

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
