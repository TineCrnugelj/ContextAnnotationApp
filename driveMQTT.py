#%% This is robot TIMO MQTT server connection and manipulation

#%% Connect to MQTT and send an action = payload ===========================
#%% Connect
import paho.mqtt.client as mqtt
import json
import time

# --- Configuration ---
BROKER = "hassio.lucami.org"       # Change to your MQTT broker address
PORT = 8883                # Change to your MQTT broker port
TOPIC = "timo/actions"     # Must match the topic in your app config

# Connect
USERNAME = "lovablemqtt"
PASSWORD = "LucamiMQTT2026*"
client = mqtt.Client()
client.username_pw_set(USERNAME, PASSWORD)
client.tls_set()
client.connect(BROKER, PORT, 60)
client.loop_start()

#%% Define actions
# --- Emoticon action payload ---
faceID = 8
#faceID = 3
eID = "eID" + str(faceID)
payloadEmo = {
    "_description": "Show emoticon " + eID,
    "action_id": eID,
    "type": "emoticon",
    "params": {"id": faceID},
    "meta": {"priority": "normal"}
}
# --- Wave hands
payloadAct = {
      "_description": "Trigger a custom robot action - wave hand.",
      "action_id": "eID5",
      "type": "robot_action",
      "params": { "code": "wave_hand" },
      "meta": { "priority": "high", "source": "python" }
    }
# --- Switch face
payloadToggleFace = {
      "_description": "Toggle between 'System Configuration & Status' and 'Robot Face'",
      "action_id": "confID1",
      "type": "control",
      "params": { "command": "toggle" },
      "meta": { "priority": "high", "source": "python" }
    }
# --- Toggle 
payloadToggleRunStop = {
    "_description": "Toggle between Play and Stop",
    "action_id": "confID2",
    "type": "control",
    "params": { "command": "run_stop" },
    "meta": { "priority": "high", "source": "python" }
}
payloadSayItDan = {
  "_description": "Say Dan in Slovenian",
  "action_id": "sayID1",
  "type": "say",
  "params": { "text": "Dan", "lang": "sl-SI" },
  "meta": { "priority": "high", "source": "python" }
}
payloadSayItDanMP3 = {
  "action_id": "dan",
  "type": "say",
  "params": {
    "text": "Dan",
    "lang": "sl-SI",
    "description": "Morning greeting in Slovenian"
  },
  "meta": {
    "timestamp": 1730000000000,
    "priority": "normal",
    "interrupt": False,
    "source": "my-publisher"
  }
}
payloadSayItNoc = {
  "_description": "Say Noč in Slovenian",
  "action_id": "sayID2",
  "type": "say",
  "params": { "text": "Noč", "lang": "sl-SI" },
  "meta": { "priority": "high", "source": "python" }
}
payloadSayItStart = {
  "_description": "Say 'Lahko začnete s kognitivnim treningom.' in Slovenian",
  "action_id": "sayID3",
  "type": "say",
  "params": { "text": "Lahko začnete s kognitivnim treningom.", "lang": "sl-SI" },
  "meta": { "priority": "high", "source": "python" }
}
payloadSayItHello = {
  "_description": "Say 'Pozdravljen!' in Slovenian",
  "action_id": "sayID4",
  "type": "say",
  "params": { "text": "Pozdravljen!", "lang": "sl-SI" },
  "meta": { "priority": "high", "source": "python" }
}

payloadSequence = {
    "type": "scenario",
    "scenario_id": "greet_demo",
    "name": "Greeting demo",
    "loop": False,
    "stop_on_error": False,
    "defaults": {
        "delay_after_ms": [500, 1500],
        "wait_for_completion": True
    },
    "context": {
        "mood": "neutral"
    },
    "steps": [
        {
            "step_id": "hello",
            "_description": "Greet the user",
            "action": {
                "action_id": "a1",
                "type": "say",
                "params": {"text": "Pozdravljen!", "lang": "sl-SI"}
            },
            "delay_after_ms": 1000
        },
        {
            "step_id": "ask",
            "_description": "Ask are you happy",
            "action": {
                "action_id": "a2",
                "type": "say",
                "params": {"text": "Si srečen?", "lang": "sl-SI"}
            },
            "delay_after_ms": [800, 1200]
        },
        {
            "step_id": "branch",
            "condition": "context.mood === 'happy'",
            "_description": "Branch",
            "action": {
                "action_id": "a3",
                "type": "emoticon",
                "params": {"id": 6}
            },
            "next": "end"
        },
        {
            "step_id": "sad_path",
            "_description": "Set to sad.",
            "action": {
                "action_id": "a4",
                "type": "emoticon",
                "params": {"id": 4}
            }
        },
        {
            "step_id": "end",
            "_description": "End sequence.",
            "action": {
                "action_id": "a5",
                "type": "say",
                "params": {"text": "Adijo!", "lang": "sl-SI"}
            }
        }
    ]
}

# Custom sequence
'''
payloadCustomSeq = {
    "type": "scenario",
    "scenario_id": "greet_demo",
    "name": "Greeting demo",
    "loop": False,
    "stop_on_error": False,
    "defaults": {
        "delay_after_ms": [500, 1500],
        "wait_for_completion": True
    },
    "context": {
        "mood": "neutral"
    },
    "steps": [ 
         {
            payloadEmo,
            "delay_after_ms": 1000
         },
         {
            payloadSayItDanMP3,
            "delay_after_ms": 1000
         }
    ]
}
'''

#%% Send action
#payload = payloadAct
payload = payloadEmo
#payload = payloadToggleFace
#payload = payloadToggleRunStop
#payload = payloadSayItDan
#payload = payloadSayItDanMP3
#payload = payloadSayItStart
#payload = payloadSayItHello
#payload = payloadSequence
#payload = payloadCustomSeq

client.publish(TOPIC, json.dumps(payload, ensure_ascii=False))
print(f"Published to {TOPIC}: {json.dumps(payload, indent=2)}")


#%% Disconnect at the end.
client.disconnect()

#%%
# Buffer






















#%% === OTHER ATTEMPTS ===============================

#%% Complete version 2
import json
import paho.mqtt.client as mqtt

BROKER = "hassio.lucami.org"
PORT = 8884
TOPIC = "timo/actions"
USERNAME = "lovablemqtt"
PASSWORD = "LucamiMQTT2026*"


payload = {
    "action_id": "eID4",
    "type": "emoticon",
    "params": {"id": 5},
    "meta": {"priority": "normal"}
}

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("Connected OK")
        client.publish(TOPIC, json.dumps(payload))
        print("Sent emoticon id=5")
        client.disconnect()
    else:
        print(f"Connection failed, rc={rc}")

def on_disconnect(client, userdata, rc):
    print("Disconnected")

client = mqtt.Client(transport="websockets")
client.username_pw_set(USERNAME, PASSWORD)

# 🔐 REQUIRED
client.tls_set()

# 🔑 ADD THIS (most important fix)
client.username_pw_set("your_username", "your_password")

client.on_connect = on_connect
client.on_disconnect = on_disconnect

client.connect(BROKER, PORT, 60)
client.loop_forever()


#%%






#%% The rest




















#%% The rest

#%% MQTT over TLS (8883) connect ==========================
import paho.mqtt.client as mqtt

BROKER = "hassio.lucami.org"
PORT = 8883

client = mqtt.Client()

# 🔐 REQUIRED for 8883
client.tls_set()

def on_connect(client, userdata, flags, rc):
	print("Connected:", rc)

client.on_connect = on_connect

client.connect(BROKER, PORT, 60)
client.loop_forever()



# %% WebSockets (8884) — connect version 1: ==========================
import paho.mqtt.client as mqtt

BROKER = "hassio.lucami.org"
PORT = 8884

client = mqtt.Client(transport="websockets")

# 🔐 REQUIRED (because it's wss://)
client.tls_set()

# ❗ NO /mqtt path needed in your case
# client.ws_set_options(path="/mqtt")  <-- DO NOT USE

def on_connect(client, userdata, flags, rc):
    print("WS connected:", rc)

client.on_connect = on_connect

client.connect(BROKER, PORT, 60)
client.loop_forever()


# %% WebSockets (8884) — connect version 2: ==========================
import paho.mqtt.client as mqtt

client = mqtt.Client(transport="websockets")

client.ws_set_options(path="/mqtt")

# 🔐 try secure websocket
client.tls_set()

client.connect("hassio.lucami.org", 8884, 60)
#client.loop_forever()

#%% Send request over existing connection to MQTT
# --- Configuration ---
BROKER = "localhost"       # Change to your MQTT broker address
PORT = 1883                # Change to your MQTT broker port
TOPIC = "timo/actions"     # Must match the topic in your app config

payload = {
    "action_id": "eID4",
    "type": "emoticon",
    "params": {"id": 5},
    "meta": {"priority": "normal"}
}
client.publish(TOPIC, json.dumps(payload))
print(f"Published to {TOPIC}: {json.dumps(payload, indent=2)}")
client.disconnect()


# %% Connect to MQQT and show emoticon
import paho.mqtt.client as mqtt
import json
import time

# --- Configuration ---
BROKER = "localhost"       # Change to your MQTT broker address
PORT = 1883                # Change to your MQTT broker port
TOPIC = "timo/actions"     # Must match the topic in your app config

# --- Emoticon action payload ---
payload = {
    "action_id": "eID4",
    "type": "emoticon",
    "params": {"id": 5},
    "meta": {"priority": "normal"}
}

client = mqtt.Client()
client.connect(BROKER, PORT, 60)
client.publish(TOPIC, json.dumps(payload))
print(f"Published to {TOPIC}: {json.dumps(payload, indent=2)}")
client.disconnect()

# %%
