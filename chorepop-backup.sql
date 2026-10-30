PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  sort_order INTEGER NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);
INSERT INTO "members" ("id","name","sort_order","created_at") VALUES('50230620-6278-43d0-b870-985ab071b995','Tharun',0,1792879430533);
INSERT INTO "members" ("id","name","sort_order","created_at") VALUES('feb9b86b-3938-4e09-b5ae-1ab6efb6837c','Thushar',1,1792879442642);
INSERT INTO "members" ("id","name","sort_order","created_at") VALUES('461f739c-4de1-42b1-9785-1fdad040722b','Pradeep',2,1792879524668);
INSERT INTO "members" ("id","name","sort_order","created_at") VALUES('2f71ace0-d8ef-4023-bc3d-f77d2691e2be','Suhas',3,1792879540732);
INSERT INTO "members" ("id","name","sort_order","created_at") VALUES('46f4beec-e0d4-4d11-b9b6-26bfdc24f03f','Akshith',4,1792879550831);
CREATE TABLE chores (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '🧹',
  current_member_id TEXT NOT NULL,
  turn_started_at INTEGER NOT NULL,
  last_reminder_at INTEGER,
  completed_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (current_member_id) REFERENCES members(id)
);
INSERT INTO "chores" ("id","title","emoji","current_member_id","turn_started_at","last_reminder_at","completed_count","created_at") VALUES('96549ba3-1b2c-405b-9c2e-82747521f640','Take out trash','🗑️','2f71ace0-d8ef-4023-bc3d-f77d2691e2be',1793242604395,1793329247983,3,1792879953174);
INSERT INTO "chores" ("id","title","emoji","current_member_id","turn_started_at","last_reminder_at","completed_count","created_at") VALUES('57fcba94-a449-48a6-90e7-b4b4c9403c29','Dish washer','🍽️','461f739c-4de1-42b1-9785-1fdad040722b',1793259987279,1793347247976,4,1792880008951);
INSERT INTO "chores" ("id","title","emoji","current_member_id","turn_started_at","last_reminder_at","completed_count","created_at") VALUES('d9ed58a9-33ad-4bd7-9ef0-ded597505364','Kitchen top','🏡','50230620-6278-43d0-b870-985ab071b995',1792880048687,1793322047533,0,1792880048687);
INSERT INTO "chores" ("id","title","emoji","current_member_id","turn_started_at","last_reminder_at","completed_count","created_at") VALUES('5b4cff61-f54d-4c60-93c7-413b8a5c36fc','Fetch Water','🛒','461f739c-4de1-42b1-9785-1fdad040722b',1793151812147,1793325647894,2,1793079857644);
INSERT INTO "chores" ("id","title","emoji","current_member_id","turn_started_at","last_reminder_at","completed_count","created_at") VALUES('e8ed1193-0c03-45e1-ad1b-2972fac233f0','Kitchen and hall way floor sweep(every sunday)','🧹','2f71ace0-d8ef-4023-bc3d-f77d2691e2be',1793215579344,1793304048117,1,1793215529763);
CREATE TABLE history (
  id TEXT PRIMARY KEY,
  chore_id TEXT,
  chore_title TEXT NOT NULL,
  member_id TEXT,
  member_name TEXT NOT NULL,
  done_at INTEGER NOT NULL,
  FOREIGN KEY (chore_id) REFERENCES chores(id) ON DELETE SET NULL,
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE SET NULL
);
INSERT INTO "history" ("id","chore_id","chore_title","member_id","member_name","done_at") VALUES('9d038a0e-10ea-4f3c-94bf-5a72d13dba74','96549ba3-1b2c-405b-9c2e-82747521f640','Take out trash','50230620-6278-43d0-b870-985ab071b995','Tharun',1793079768806);
INSERT INTO "history" ("id","chore_id","chore_title","member_id","member_name","done_at") VALUES('031e9d67-edad-4db7-82f0-ce03c0ad5f68','5b4cff61-f54d-4c60-93c7-413b8a5c36fc','Fetch Water','50230620-6278-43d0-b870-985ab071b995','Tharun',1793079859404);
INSERT INTO "history" ("id","chore_id","chore_title","member_id","member_name","done_at") VALUES('c80a5219-88ce-47f8-9d48-2be006da84e0','57fcba94-a449-48a6-90e7-b4b4c9403c29','Dish washer','2f71ace0-d8ef-4023-bc3d-f77d2691e2be','Suhas',1793080019444);
INSERT INTO "history" ("id","chore_id","chore_title","member_id","member_name","done_at") VALUES('d8407dce-d53f-4856-b025-e077447f8ed2','57fcba94-a449-48a6-90e7-b4b4c9403c29','Dish washer','46f4beec-e0d4-4d11-b9b6-26bfdc24f03f','Akshith',1793080827869);
INSERT INTO "history" ("id","chore_id","chore_title","member_id","member_name","done_at") VALUES('a3c4c958-e903-4bea-860f-1d2c98002224','96549ba3-1b2c-405b-9c2e-82747521f640','Take out trash','feb9b86b-3938-4e09-b5ae-1ab6efb6837c','Thushar',1793147745916);
INSERT INTO "history" ("id","chore_id","chore_title","member_id","member_name","done_at") VALUES('4d403dc1-70a9-44c0-a168-291826f66002','5b4cff61-f54d-4c60-93c7-413b8a5c36fc','Fetch Water','feb9b86b-3938-4e09-b5ae-1ab6efb6837c','Thushar',1793151812147);
INSERT INTO "history" ("id","chore_id","chore_title","member_id","member_name","done_at") VALUES('e2d39190-f117-4b41-a6f3-95221825f639','57fcba94-a449-48a6-90e7-b4b4c9403c29','Dish washer','50230620-6278-43d0-b870-985ab071b995','Tharun',1793169349643);
INSERT INTO "history" ("id","chore_id","chore_title","member_id","member_name","done_at") VALUES('df85064b-eda1-4e45-9154-2828eebe57fa','e8ed1193-0c03-45e1-ad1b-2972fac233f0','Kitchen floor sweep(every sunday)','461f739c-4de1-42b1-9785-1fdad040722b','Pradeep',1793215579344);
INSERT INTO "history" ("id","chore_id","chore_title","member_id","member_name","done_at") VALUES('c183730d-07cf-4288-bb92-55042926404f','96549ba3-1b2c-405b-9c2e-82747521f640','Take out trash','461f739c-4de1-42b1-9785-1fdad040722b','Pradeep',1793242604395);
INSERT INTO "history" ("id","chore_id","chore_title","member_id","member_name","done_at") VALUES('45fa1b50-45b3-49a3-926d-5cc949bcc1d7','57fcba94-a449-48a6-90e7-b4b4c9403c29','Dish washer','feb9b86b-3938-4e09-b5ae-1ab6efb6837c','Thushar',1793259987279);
CREATE TABLE push_subscriptions (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
);
INSERT INTO "push_subscriptions" ("id","member_id","endpoint","p256dh","auth","updated_at") VALUES('f637e121-dc4e-4f9f-a4df-5e57213bc0c4','50230620-6278-43d0-b870-985ab071b995','https://web.push.apple.com/QEoB5_jAH6R5-3pZUKAS-K2T0zU-bxFJKnv0_n8MtnCJ9AZWG3f26Fur7VCTdXBK0K_vDZiXUMa7aftAKbLeF1mfAfhXqgOmKxZMRhZRBsMZeOvps4BcMHSfPK6J2Of9fR9SqRD5vF7OECAJDdgXTsWaORoNIqUEUQOYaBy_GjA','BPl8fto7fuAqsKp0QwuorWeUp9ADi0Jj0qbRaRu69IP4cJ-jlURfZz6AdyhqoTDYWXFeuh-5eaqrfsVNHYC8Jm4','FYaUZ5oN6yG-t6ifp_FBGQ',1793079923571);
INSERT INTO "push_subscriptions" ("id","member_id","endpoint","p256dh","auth","updated_at") VALUES('975d04fc-c7a0-4c07-a0e7-053ca2f4ba36','461f739c-4de1-42b1-9785-1fdad040722b','https://web.push.apple.com/QJGzHu1vgxBxNn2gGW63z7EyCX25zLnb3bKiXlui2NWA8tcLc6TsyIQFS6OWDgyDfRC_gavg-d_62BU8J53Vs5nln9yFkrX6ZgVajA8m6qPAVWCKYtxdEdA7E96HQtyTFyhq5er3GErvcUJjEPcVs-BgdkyXxNZF6lmIIjG6DXA','BOkaM5_y-wC781GeGhzS4y9PdmOBSNqs9BqZcLpY4kaJLMS0wCcXwqQwrxSZbQdHGbbn6kZjnqkzQcPOSm5Bx9g','Ce0UkWU0Z8wYeSXo1LVFpA',1792885240904);
CREATE INDEX idx_chores_member ON chores(current_member_id);
CREATE INDEX idx_chores_reminder ON chores(turn_started_at, last_reminder_at);
CREATE INDEX idx_history_done ON history(done_at DESC);
CREATE INDEX idx_push_member ON push_subscriptions(member_id);
