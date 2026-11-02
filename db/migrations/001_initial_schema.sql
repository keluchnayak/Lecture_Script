-- ============================================================================
-- Migration: 001_initial_schema.sql
-- Application: LectureScript
-- Database: Neon PostgreSQL
-- Description: Core schema with UUIDs, TIMESTAMPTZ, session hashing,
--              local-first sync versioning, and soft deletions.
-- ============================================================================

-- Enable pgcrypto / uuid extension for cryptographic UUID generation if needed
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Migration Tracking Table
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(100) PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  nickname VARCHAR(100) NOT NULL,
  profile_photo_url TEXT,
  email_verified_at TIMESTAMPTZ,
  account_status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'suspended', 'pending')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Case-insensitive unique index for normalized email addresses
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users (created_at);

-- 2. Auth Sessions Table (Never stores plaintext tokens)
CREATE TABLE IF NOT EXISTS auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions (expires_at);

-- 3. Email Verification Tokens (Hashed, Single-Use, Expirable)
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_verify_user_id ON email_verification_tokens (user_id);

-- 4. Password Reset Tokens (Hashed, Single-Use, Expirable)
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_user_id ON password_reset_tokens (user_id);

-- 5. User Settings Table (Cross-device preferences)
CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  character_preference VARCHAR(50) NOT NULL DEFAULT 'girl',
  timezone VARCHAR(100) NOT NULL DEFAULT 'UTC',
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Lectures Table (Local-first with versioning, payload JSONB, soft-delete)
CREATE TABLE IF NOT EXISTS lectures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id VARCHAR(100) NOT NULL,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  note_style VARCHAR(50) DEFAULT 'cornell',
  payload JSONB NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT uq_lectures_user_client UNIQUE (user_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_lectures_user_active ON lectures (user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_lectures_user_updated ON lectures (user_id, updated_at);

-- 7. Practice Progress Table (Stable item tracking across recall, traps, formulas)
CREATE TABLE IF NOT EXISTS practice_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lecture_id UUID REFERENCES lectures(id) ON DELETE CASCADE,
  item_id VARCHAR(100) NOT NULL,
  confidence VARCHAR(50) NOT NULL DEFAULT 'mastered' CHECK (confidence IN ('mastered', 'missed', 'review')),
  difficulty VARCHAR(50) NOT NULL DEFAULT 'medium',
  review_count INTEGER NOT NULL DEFAULT 1,
  last_reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_practice_user_lecture_item UNIQUE (user_id, lecture_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_practice_progress_user_lecture ON practice_progress (user_id, lecture_id);
CREATE INDEX IF NOT EXISTS idx_practice_progress_last_reviewed ON practice_progress (user_id, last_reviewed_at);

-- 8. Flashcard Decks Table
CREATE TABLE IF NOT EXISTS flashcard_decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id VARCHAR(100),
  source_lecture_id UUID REFERENCES lectures(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  subject TEXT,
  color_theme VARCHAR(50) DEFAULT 'lavender',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT uq_decks_user_client UNIQUE (user_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_decks_user_active ON flashcard_decks (user_id) WHERE deleted_at IS NULL;

-- 9. Flashcards Table
CREATE TABLE IF NOT EXISTS flashcards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id UUID NOT NULL REFERENCES flashcard_decks(id) ON DELETE CASCADE,
  client_id VARCHAR(100),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  tag VARCHAR(100) DEFAULT 'High-Yield',
  difficulty VARCHAR(50) DEFAULT 'medium',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flashcards_deck_position ON flashcards (deck_id, position);

-- 10. Flashcard Progress Table
CREATE TABLE IF NOT EXISTS flashcard_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  flashcard_id UUID NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
  confidence VARCHAR(50) NOT NULL DEFAULT 'known' CHECK (confidence IN ('known', 'review', 'unseen')),
  review_count INTEGER NOT NULL DEFAULT 1,
  last_reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  next_review_at TIMESTAMPTZ,
  CONSTRAINT uq_flashcard_progress_user_card UNIQUE (user_id, flashcard_id)
);

CREATE INDEX IF NOT EXISTS idx_flashcard_progress_user ON flashcard_progress (user_id);
CREATE INDEX IF NOT EXISTS idx_flashcard_progress_next_review ON flashcard_progress (user_id, next_review_at);

-- 11. Study Activity Days Table (Daily streak & active session tracking)
CREATE TABLE IF NOT EXISTS study_activity_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_date DATE NOT NULL,
  active_seconds INTEGER NOT NULL DEFAULT 0,
  sessions_count INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT uq_study_activity_user_date UNIQUE (user_id, activity_date)
);

CREATE INDEX IF NOT EXISTS idx_study_activity_user_date ON study_activity_days (user_id, activity_date);
