-- Flow execution engine tables

-- Each flow execution tracks one run of a flow for one conversation
CREATE TABLE IF NOT EXISTS flow_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id uuid NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  customer_phone text NOT NULL,
  phone_number_id text NOT NULL,
  current_node_id text NOT NULL,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('pending', 'running', 'paused', 'completed', 'error')),
  context jsonb DEFAULT '{}'::jsonb,
  started_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  next_step_at timestamptz,
  completed_at timestamptz,
  error text,
  execution_key text UNIQUE
);

-- Prevent multiple active executions for the same conversation+flow
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_execution
  ON flow_executions(flow_id, conversation_id)
  WHERE status IN ('running', 'paused', 'pending');

-- Index for polling expired wait nodes
CREATE INDEX IF NOT EXISTS idx_flow_exec_next_step
  ON flow_executions (next_step_at)
  WHERE status = 'paused';

CREATE INDEX IF NOT EXISTS idx_flow_exec_convflow
  ON flow_executions (flow_id, conversation_id)
  WHERE status IN ('running', 'paused', 'pending');

-- Audit log for each step execution
CREATE TABLE IF NOT EXISTS flow_execution_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id uuid NOT NULL REFERENCES flow_executions(id) ON DELETE CASCADE,
  node_id text NOT NULL,
  action text NOT NULL,
  result jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_flow_logs_exec ON flow_execution_logs(execution_id);
