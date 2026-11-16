CREATE TABLE users (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email text NOT NULL UNIQUE,
    password_hash text NOT NULL,
    name text NOT NULL,
    timezone text NOT NULL
);
CREATE TABLE sessions (
    token_hash bytea PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users ON DELETE CASCADE,
    expires_at timestamptz NOT NULL
);
CREATE INDEX sessions_user ON sessions (user_id);
CREATE INDEX sessions_expiry ON sessions (expires_at);
CREATE TABLE periods (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users ON DELETE CASCADE,
    start_date date NOT NULL,
    end_date date,
    CHECK (end_date IS NULL OR end_date >= start_date)
);
CREATE INDEX periods_user_start ON periods (user_id, start_date);
CREATE TABLE checkins (
    user_id bigint NOT NULL REFERENCES users ON DELETE CASCADE,
    day date NOT NULL,
    mood text NOT NULL,
    symptoms text[] NOT NULL,
    PRIMARY KEY (user_id, day)
);
CREATE TABLE auth_limits (
    bucket bytea PRIMARY KEY,
    attempts integer NOT NULL,
    expires_at timestamptz NOT NULL
);
CREATE INDEX auth_limits_expiry ON auth_limits (expires_at);
