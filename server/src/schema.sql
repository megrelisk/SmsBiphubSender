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
