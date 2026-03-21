-- Commission Calculator Schema
-- Run this in your Supabase SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- DEALS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS deals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_name TEXT NOT NULL,
  deal_name TEXT NOT NULL,
  service_type TEXT NOT NULL CHECK (service_type IN ('IdeaGen', 'Other')),
  deal_type TEXT NOT NULL CHECK (deal_type IN ('Implementation', 'Renewal', 'SoftwareResale')),
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Closed', 'Invoiced')),
  total_value DECIMAL(14,2) DEFAULT 0,
  notes TEXT,
  close_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DEAL LINE ITEMS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS deal_line_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  net_profit DECIMAL(14,2),
  gross_margin_percent DECIMAL(6,2),
  invoice_date DATE,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Invoiced')),
  year_number INTEGER DEFAULT 1,
  is_upsell BOOLEAN DEFAULT FALSE,
  commission_rate DECIMAL(6,4),
  commission_amount DECIMAL(14,2),
  is_excluded BOOLEAN DEFAULT FALSE,
  exclusion_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PAYCHECKS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS paychecks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pay_date DATE,
  pay_period_start DATE,
  pay_period_end DATE,
  gross_amount DECIMAL(14,2),
  commission_amount DECIMAL(14,2),
  base_salary DECIMAL(14,2),
  other_earnings DECIMAL(14,2),
  total_deductions DECIMAL(14,2),
  net_amount DECIMAL(14,2),
  file_name TEXT,
  extracted_text TEXT,
  extracted_data JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_deal_line_items_deal_id ON deal_line_items(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_line_items_invoice_date ON deal_line_items(invoice_date);
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);
CREATE INDEX IF NOT EXISTS idx_paychecks_pay_date ON paychecks(pay_date);

-- ============================================================
-- DISABLE RLS (personal app - no auth needed)
-- ============================================================
ALTER TABLE deals DISABLE ROW LEVEL SECURITY;
ALTER TABLE deal_line_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE paychecks DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- AUTO-UPDATE updated_at TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_deals_updated_at
  BEFORE UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_line_items_updated_at
  BEFORE UPDATE ON deal_line_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
