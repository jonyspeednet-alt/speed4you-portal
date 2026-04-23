select count(*)::int as total,
       count(*) filter (where payload->>'sourceType'='scanner')::int as scanner_total,
       count(*) filter (where payload->>'sourceType'='scanner' and payload->>'status'='draft')::int as scanner_draft,
       count(*) filter (where payload->>'sourceType'='scanner' and payload->>'status'='published')::int as scanner_published,
       count(*) filter (where payload->>'sourceType'='scanner' and payload->>'metadataStatus'='matched')::int as matched,
       count(*) filter (where payload->>'sourceType'='scanner' and payload->>'metadataStatus'='needs_review')::int as needs_review,
       count(*) filter (where payload->>'sourceType'='scanner' and payload->>'metadataStatus'='not_found')::int as not_found,
       count(*) filter (where payload->>'sourceType'='scanner' and payload->>'metadataStatus'='failed')::int as failed
from content_catalog;

update content_catalog
set payload = jsonb_set(
      jsonb_set(payload, '{status}', to_jsonb('published'::text), true),
      '{updatedAt}', to_jsonb(now()::text), true
    ),
    updated_at = now()
where payload->>'sourceType' = 'scanner'
  and coalesce(payload->>'status', '') <> 'published';

select count(*)::int as total,
       count(*) filter (where payload->>'sourceType'='scanner')::int as scanner_total,
       count(*) filter (where payload->>'sourceType'='scanner' and payload->>'status'='draft')::int as scanner_draft,
       count(*) filter (where payload->>'sourceType'='scanner' and payload->>'status'='published')::int as scanner_published
from content_catalog;