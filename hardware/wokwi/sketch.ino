/*
 * Lights, Fans, Discord — Representative Room Controller (concept)
 * Techathon Nationals & Rover Summit — Deliverable #2 (Hardware/Electrical Schematic)
 *
 * This Wokwi demo models ONE room (work1): 3 lights + 2 fans + 1 controller.
 * It does not drive the live app. The backend remains the source of truth for
 * the product demo; this sketch only demonstrates electrically sensible control.
 *
 * Submission wiring model:
 *   - ALL five AC loads are switched through relay modules.
 *   - Yellow LEDs stand in for AC lights on the relay contact side.
 *   - Cyan LEDs stand in for AC fan load indicators on the relay contact side.
 *   - A potentiometer stands in for an optional ACS712 analog current sensor.
 *
 * To keep the schematic clean for grading, there are no manual wall switches in
 * the circuit. The controller auto-cycles through a fixed demo pattern instead.
 */

const int LIGHT_RELAY[3] = {4, 5, 18};
const int FAN_RELAY[2] = {19, 21};
const int CURRENT_PIN = 34;  // ADC1 input only

const float FAN_W = 60.0;
const float LIGHT_W = 15.0;

const bool DEMO_STEPS[][5] = {
  {false, false, false, false, false},  // all off
  {true,  false, false, false, false},  // light-1
  {true,  true,  false, false, false},  // light-1..2
  {true,  true,  true,  false, false},  // all lights
  {true,  true,  true,  true,  false},  // lights + fan-1
  {true,  true,  true,  true,  true },  // all on
  {false, false, false, true,  true },  // fans only
  {false, false, true,  false, true },  // mixed room state
};

const int DEMO_STEP_COUNT = sizeof(DEMO_STEPS) / sizeof(DEMO_STEPS[0]);
int demoStep = 0;

void applyOutputs(const bool state[5]) {
  for (int i = 0; i < 3; i++) {
    digitalWrite(LIGHT_RELAY[i], state[i] ? HIGH : LOW);
  }
  for (int i = 0; i < 2; i++) {
    digitalWrite(FAN_RELAY[i], state[i + 3] ? HIGH : LOW);
  }
}

void setup() {
  Serial.begin(115200);

  for (int i = 0; i < 3; i++) {
    pinMode(LIGHT_RELAY[i], OUTPUT);
    digitalWrite(LIGHT_RELAY[i], LOW);
  }
  for (int i = 0; i < 2; i++) {
    pinMode(FAN_RELAY[i], OUTPUT);
    digitalWrite(FAN_RELAY[i], LOW);
  }

  Serial.println("controller-1 online (representative room: work1, relay demo mode)");
}

void loop() {
  const bool* state = DEMO_STEPS[demoStep];
  applyOutputs(state);

  int raw = analogRead(CURRENT_PIN);
  float sensedAmps = (raw / 4095.0) * 10.0;

  float modelledW = 0;
  int loadsOn = 0;
  for (int i = 0; i < 3; i++) {
    if (state[i]) {
      modelledW += LIGHT_W;
      loadsOn++;
    }
  }
  for (int i = 0; i < 2; i++) {
    if (state[i + 3]) {
      modelledW += FAN_W;
      loadsOn++;
    }
  }

  Serial.print("{\"room\":\"work1\",\"controller\":\"online\",\"loads_on\":");
  Serial.print(loadsOn);
  Serial.print(",\"modelled_power_w\":");
  Serial.print(modelledW, 0);
  Serial.print(",\"sensed_amps\":");
  Serial.print(sensedAmps, 2);
  Serial.print(",\"devices\":{");
  for (int i = 0; i < 3; i++) {
    Serial.print("\"light-");
    Serial.print(i + 1);
    Serial.print("\":\"");
    Serial.print(state[i] ? "on" : "off");
    Serial.print("\",");
  }
  for (int i = 0; i < 2; i++) {
    Serial.print("\"fan-");
    Serial.print(i + 1);
    Serial.print("\":\"");
    Serial.print(state[i + 3] ? "on" : "off");
    Serial.print(i < 1 ? "\"," : "\"");
  }
  Serial.println("}}");

  demoStep = (demoStep + 1) % DEMO_STEP_COUNT;
  delay(1000);
}
