begin;
create extension if not exists pg_jsonschema with schema extensions;
create function app_private.valid_incident_draft_payload(p_payload jsonb) returns boolean
language plpgsql immutable set search_path='' as $function$
begin
  if not extensions.jsonb_matches_schema($schema${
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "schemaVersion": {
      "type": "number",
      "const": 1
    },
    "step": {
      "anyOf": [
        {
          "type": "number",
          "const": 1
        },
        {
          "type": "number",
          "const": 2
        },
        {
          "type": "number",
          "const": 3
        },
        {
          "type": "number",
          "const": 4
        },
        {
          "type": "number",
          "const": 5
        },
        {
          "type": "number",
          "const": 6
        }
      ]
    },
    "officerConfirmed": {
      "type": "boolean"
    },
    "selectedRelationships": {
      "maxItems": 60,
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}:(reporting_officer|involved_officer|witness)$"
      },
      "uniqueItems": true
    },
    "factReportingScopes": {
      "type": "object",
      "propertyNames": {
        "type": "string",
        "minLength": 1,
        "maxLength": 256
      },
      "additionalProperties": {
        "maxItems": 20,
        "type": "array",
        "items": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      }
    },
    "reportsReviewed": {
      "type": "boolean"
    },
    "incidentNumber": {
      "type": "string",
      "maxLength": 80
    },
    "incidentName": {
      "type": "string",
      "maxLength": 160
    },
    "occurredAt": {
      "type": "string",
      "maxLength": 64
    },
    "location": {
      "type": "string",
      "maxLength": 8000
    },
    "category": {
      "type": "string",
      "maxLength": 100
    },
    "categoryConfirmed": {
      "type": "boolean"
    },
    "notes": {
      "type": "string",
      "maxLength": 20000
    },
    "factProposals": {
      "maxItems": 200,
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "key": {
            "type": "string",
            "minLength": 1,
            "maxLength": 256
          },
          "sourceText": {
            "type": "string",
            "maxLength": 8000
          },
          "value": {
            "type": "string",
            "maxLength": 8000
          },
          "decision": {
            "type": "string",
            "enum": [
              "pending",
              "confirmed",
              "excluded"
            ]
          }
        },
        "required": [
          "key",
          "sourceText",
          "value",
          "decision"
        ],
        "additionalProperties": false
      }
    },
    "unknown": {
      "type": "string",
      "maxLength": 500
    },
    "checklistAnswers": {
      "maxItems": 100,
      "type": "array",
      "items": {
        "oneOf": [
          {
            "type": "object",
            "properties": {
              "questionId": {
                "type": "string",
                "pattern": "^[a-z][a-z0-9_]{1,63}$"
              },
              "state": {
                "type": "string",
                "const": "answered"
              },
              "value": {
                "type": "string",
                "minLength": 1,
                "maxLength": 8000
              }
            },
            "required": [
              "questionId",
              "state",
              "value"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "questionId": {
                "type": "string",
                "pattern": "^[a-z][a-z0-9_]{1,63}$"
              },
              "state": {
                "type": "string",
                "const": "unknown"
              }
            },
            "required": [
              "questionId",
              "state"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "questionId": {
                "type": "string",
                "pattern": "^[a-z][a-z0-9_]{1,63}$"
              },
              "state": {
                "type": "string",
                "const": "not_applicable"
              }
            },
            "required": [
              "questionId",
              "state"
            ],
            "additionalProperties": false
          }
        ]
      }
    }
  },
  "required": [
    "schemaVersion",
    "step",
    "officerConfirmed",
    "selectedRelationships",
    "factReportingScopes",
    "reportsReviewed",
    "incidentNumber",
    "incidentName",
    "occurredAt",
    "location",
    "category",
    "categoryConfirmed",
    "notes",
    "factProposals",
    "unknown",
    "checklistAnswers"
  ],
  "additionalProperties": false
}$schema$::json,p_payload) then return false; end if;
  return (select count(*) = count(distinct answer->>'questionId') from jsonb_array_elements(p_payload->'checklistAnswers') answer)
    and not exists(select 1 from jsonb_array_elements(p_payload->'checklistAnswers') answer where answer->>'state'='answered' and length(btrim(answer->>'value'))=0);
end;
$function$;
revoke all on function app_private.valid_incident_draft_payload(jsonb) from public,anon,authenticated,service_role;
alter table app_private.incident_drafts add constraint incident_draft_envelope_valid check (app_private.valid_incident_draft_payload(payload));
commit;
