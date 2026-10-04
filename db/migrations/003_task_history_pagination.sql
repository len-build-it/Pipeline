CREATE INDEX IF NOT EXISTS idx_task_comments_history
  ON task_comments (task_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_activity_task_history
  ON activity_events (organization_id, entity_id, created_at DESC, id DESC)
  WHERE entity_type = 'task';
