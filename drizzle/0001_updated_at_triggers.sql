CREATE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = clock_timestamp();
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER people_updated_at BEFORE UPDATE ON people
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER relationships_updated_at BEFORE UPDATE ON relationships
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
