-- Conversation tags (used by flow nodes add_tag / remove_tag)

CREATE TABLE IF NOT EXISTS conversation_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6b7280',
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_conversation_tags_user ON conversation_tags(user_id);

CREATE TABLE IF NOT EXISTS conversation_tag_assignments (
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES conversation_tags(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (conversation_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_conv_tag_assign_conv ON conversation_tag_assignments(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conv_tag_assign_tag ON conversation_tag_assignments(tag_id);

ALTER TABLE conversation_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_tag_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own conversation_tags"
  ON conversation_tags FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users read own conversation_tag_assignments"
  ON conversation_tag_assignments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM conversation_tags ct
      WHERE ct.id = conversation_tag_assignments.tag_id AND ct.user_id = auth.uid()
    )
  );
