/*
 * Lights, Fans, Discord — Representative Room Controller (concept)
 * Techathon Nationals & Rover Summit — Deliverable #2 (Hardware/Electrical Schematic)
 *
 * This is a SIMULATION/CONCEPT for ONE room (matching the fixed device model:
 * 1 controller + 2 fans + 3 lights). It proves the sensing/actuation concept —
 * it does NOT feed the running app. The live app uses simulated data in the backend.
 *
 * Role of the ESP32 ("controller-1"):
 *   - READS the on/off intent of each device from a wall switch (slide switch).
 *   - DRIVES a stand-in load so the state is visible:
 *       lights -> LEDs (through 220 ohm current-limiting resistors)
 *       fans   -> relay modules (a GPIO cannot switch a mains fan directly, so it
 *                 switches a relay; the relay output powers an indicator LED here).
 *   - SENSES total room current draw from an analog sensor (a potentiometer here
 *     stands in for an ACS712 hall-effect current sensor on the room's supply line).
 *   - PRINTS a JSON status line every second in the SAME shape the backend uses,
 *     to show how a real controller would report device state upstream.
 *
 * Rated power matches the backend contract: fan = 60 W, light = 15 W.
 */

// ---- Pin map (see hardware/README.md for the wiring rationale) ----
const int LIGHT_SW[3]  = {13, 14, 27};   // slide-switch inputs, INPUT_PULLDOWN
const int FAN_SW[2]    = {26, 25};       // slide-switch inputs, INPUT_PULLDOWN
const int LIGHT_LED[3] = {18, 19, 21};   // LED outputs (via 220 ohm)
const int FAN_DRV[2]   = {22, 23};       // relay IN drive, switches the fan
const int CURRENT_PIN  = 36;             // ADC1_CH0 (VP): analog current sensor

// ---- Rated power, matching docs/api-contract.md ----
const float FAN_W   = 60.0;
const float LIGHT_W = 15.0;

void setup() {
  Serial.begin(115200);

  for (int i = 0; i < 3; i++) {
    pinMode(LIGHT_SW[i], INPUT_PULLDOWN);
    pinMode(LIGHT_LED[i], OUTPUT);
  }
  for (int i = 0; i < 2; i++) {
    pinMode(FAN_SW[i], INPUT_PULLDOWN);
    pinMode(FAN_DRV[i], OUTPUT);
  }
  // ADC pin needs no pinMode; analogRead configures it.

  Serial.println("controller-1 online (representative room: work1)");
}

void loop() {
  bool lightOn[3];
  bool fanOn[2];

  // 1) READ device state from the wall switches, and mirror to the load.
  for (int i = 0; i < 3; i++) {
    lightOn[i] = digitalRead(LIGHT_SW[i]) == HIGH;
    digitalWrite(LIGHT_LED[i], lightOn[i] ? HIGH : LOW);
  }
  for (int i = 0; i < 2; i++) {
    fanOn[i] = digitalRead(FAN_SW[i]) == HIGH;
    digitalWrite(FAN_DRV[i], fanOn[i] ? HIGH : LOW);
  }

  // 2) SENSE current. An ACS712 outputs ~2.5 V at 0 A and swings with load.
  //    Here we read the raw ADC and map it to an illustrative amperage.
  int raw = analogRead(CURRENT_PIN);          // 0..4095 on the ESP32 ADC
  float sensedAmps = (raw / 4095.0) * 10.0;   // 0..10 A illustrative range

  // 3) Compute this room's modelled power from device state (fan/light only).
  float modelledW = 0;
  int loadsOn = 0;
  for (int i = 0; i < 3; i++) if (lightOn[i]) { modelledW += LIGHT_W; loadsOn++; }
  for (int i = 0; i < 2; i++) if (fanOn[i])   { modelledW += FAN_W;   loadsOn++; }

  // 4) REPORT upstream, in the backend's device-model shape.
  Serial.print("{\"room\":\"work1\",\"controller\":\"online\",\"loads_on\":");
  Serial.print(loadsOn);
  Serial.print(",\"modelled_power_w\":");
  Serial.print(modelledW, 0);
  Serial.print(",\"sensed_amps\":");
  Serial.print(sensedAmps, 2);
  Serial.print(",\"devices\":{");
  for (int i = 0; i < 3; i++) {
    Serial.print("\"light-"); Serial.print(i + 1); Serial.print("\":\"");
    Serial.print(lightOn[i] ? "on" : "off"); Serial.print("\",");
  }
  for (int i = 0; i < 2; i++) {
    Serial.print("\"fan-"); Serial.print(i + 1); Serial.print("\":\"");
    Serial.print(fanOn[i] ? "on" : "off");
    Serial.print(i < 1 ? "\"," : "\"");
  }
  Serial.println("}}");

  delay(1000);
}
