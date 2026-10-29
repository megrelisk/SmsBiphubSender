CREATE TABLE IF NOT EXISTS templates (
  id         SERIAL PRIMARY KEY,
  name       TEXT UNIQUE NOT NULL,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS campaigns (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  sender       TEXT NOT NULL,
  body         TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status       TEXT NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE | CANCELLED
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- თითო მესიჯს აქვს უნიკალური id (UUID). ის იგზავნება როგორც clientMessageId
-- და clientReference-ის საფუძველია, ამიტომ ერთი მესიჯი ორჯერ ვერ გაიგზავნება.
CREATE TABLE IF NOT EXISTS messages (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id        INT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  to_number          TEXT NOT NULL,
  text               TEXT NOT NULL,
  -- PENDING     ელოდება გაგზავნას
  -- SENDING     მოთხოვნა გაიგზავნა, პასუხი ჯერ არ ვიცით
  -- SUBMITTED   Beephub-მა მიიღო, ველოდებით საბოლოო სტატუსს
  -- DELIVERED   მიწოდებულია
  -- FAILED_PERMANENT  მუდმივი შეცდომა, ხელახლა არ ვცდით
  -- FAILED_FINAL      დროებითი შეცდომა, მაგრამ ცდები ამოიწურა
  -- NEEDS_REVIEW      შედეგი გაურკვეველია; ავტომატურად აღარ ვაგზავნით დუბლირების თავიდან ასაცილებლად
  -- CANCELLED
  status             TEXT NOT NULL DEFAULT 'PENDING',
  attempts           INT NOT NULL DEFAULT 0,
  send_seq           INT NOT NULL DEFAULT 0,   -- ყოველი ახალი მოთხოვნა -> ახალი clientReference
  resend_count       INT NOT NULL DEFAULT 0,   -- იგივე reference-ით განმეორება გაურკვეველი პასუხის შემდეგ
  client_reference   TEXT,
  beephub_message_id UUID,
  delivery_status    TEXT,
  error_code         TEXT,
  error_kind         TEXT,           -- PERMANENT | TEMPORARY | CONFIG | THROTTLED
  error_message      TEXT,
  next_action_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at       TIMESTAMPTZ,
  completed_at       TIMESTAMPTZ,
  UNIQUE (campaign_id, to_number)
);

CREATE INDEX IF NOT EXISTS messages_due_idx ON messages (status, next_action_at);
CREATE INDEX IF NOT EXISTS messages_campaign_idx ON messages (campaign_id);

-- კაბინეტები: თითოეულს თავისი Sender ID, ბალანსი და ფასი
CREATE TABLE IF NOT EXISTS cabinets (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  sender        TEXT NOT NULL,
  balance_gel   NUMERIC(12,4) NOT NULL DEFAULT 0,
  price_per_sms NUMERIC(8,4)  NOT NULL DEFAULT 0,   -- ლარი ერთ fragment-ზე
  sort_order    INT NOT NULL DEFAULT 0
);

INSERT INTO cabinets (id, name, sender, sort_order) VALUES
  ('kea',    'KEA Academy', 'KEA Academy', 1),
  ('mindup', 'Mind up',     'Mind up',     2)
ON CONFLICT (id) DO NOTHING;

-- ჩვენებადი სახელები (Sender ID არ იცვლება)
INSERT INTO cabinets (id, name, sender, sort_order) VALUES
  ('kea',      'Kea academy', 'KEA Academy', 1),
  ('mindup',   'Mind up',     'Mind up',     2),
  ('trainers', 'Trainers',    'Trainers',    3)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

ALTER TABLE templates ADD COLUMN IF NOT EXISTS cabinet TEXT NOT NULL DEFAULT 'kea';
ALTER TABLE templates DROP CONSTRAINT IF EXISTS templates_name_key;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS folder TEXT NOT NULL DEFAULT '';
DROP INDEX IF EXISTS templates_cabinet_name_idx;
CREATE UNIQUE INDEX IF NOT EXISTS templates_cabinet_folder_name_idx ON templates (cabinet, folder, name);

ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS cabinet TEXT NOT NULL DEFAULT 'kea';
ALTER TABLE messages  ADD COLUMN IF NOT EXISTS fragments INT NOT NULL DEFAULT 1;

-- შავი სია: ამ ნომრებზე არასდროს იგზავნება (ყველა კაბინეტისთვის)
CREATE TABLE IF NOT EXISTS blocked_numbers (
  phone      TEXT PRIMARY KEY,
  note       TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- შაბლონების საქაღალდეები (ცარიელიც რომ შეიქმნას); შაბლონი საქაღალდეს templates.folder-ით უკავშირდება
CREATE TABLE IF NOT EXISTS template_folders (
  cabinet TEXT NOT NULL,
  name    TEXT NOT NULL,
  PRIMARY KEY (cabinet, name)
);
