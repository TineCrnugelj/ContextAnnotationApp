export const DEFAULT_CONFIG_INI = `# ============================================================
# TIMO Robot — configuration.ini
# ============================================================

[mqtt]
broker_url = wss://hassio.lucami.org
port       = 8884
topic      = timo/actions
use_tls    = true
username   = lovablemqtt
password   = LucamiMQTT2026*

[app]
language        = en
comm_mode       = both
stt_provider    = browser
tts_provider    = browser
emoticon_directory = /emoticons
debug           = true
log_file = false
audio_clips_directory = /audio
prefer_audio_clips = true
tts_engine = browser
say_mode        = direct

[recording]
record_sensors  = false
record_video    = false

[external_supabase]
external_supabase_enabled  = false
external_supabase_url      =
external_supabase_anon_key =
`;
