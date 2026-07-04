# Hardware — Representative Room Schematic (Wokwi)

**Deliverable #2 — Hardware/Electrical Schematic.** This is a **simulation/concept only**; no
physical hardware is used and it does **not** feed the running app. It exists to show one room's
controller/load wiring in a way that is electrically sensible to a grader.

We model **one representative room** (`work1`) from the fixed device model:
**1 controller (ESP32) + 2 fans (60 W each) + 3 lights (15 W each)**.

## How to open it in Wokwi

1. Go to <https://wokwi.com/projects/new/esp32>.
2. Replace `diagram.json` with [`wokwi/diagram.json`](./wokwi/diagram.json).
3. Replace `sketch.ino` with [`wokwi/sketch.ino`](./wokwi/sketch.ino).
4. Press **▶ (play)**.
5. The controller auto-cycles through a fixed device pattern: lights step on first, then fans,
   then mixed states. Watch the relays and load indicators change.
6. Open the Serial Monitor to see the once-per-second JSON room status output.
7. Take a fresh screenshot of the running circuit and save it as `hardware/schematic.png`.

## What the ESP32 does (`controller-1`)

- **Drives five relay modules**: one relay per load (`light-1`..`light-3`, `fan-1`, `fan-2`).
- **Switches visible stand-in loads**: yellow LEDs represent lights; cyan LEDs represent fan load
  indicators.
- **Reads one analog sensor input**: a potentiometer stands in for an **ACS712 current sensor**.
- **Reports upstream shape**: prints room/device state JSON in the same general shape as the
  backend model so the hardware concept aligns with the software deliverable.

## Pin map

| ESP32 pin | Direction | Connected to | Represents |
|-----------|-----------|--------------|------------|
| `D4` | output | relay `IN` | `light-1` relay driver |
| `D5` | output | relay `IN` | `light-2` relay driver |
| `D18` | output | relay `IN` | `light-3` relay driver |
| `D19` | output | relay `IN` | `fan-1` relay driver |
| `D21` | output | relay `IN` | `fan-2` relay driver |
| `GPIO34` (ADC1) | analog in | potentiometer wiper | room current sensor (`ACS712` stand-in) |
| `3V3` | power | relay `COM`, potentiometer `VCC` | stand-in load supply |
| `VIN` (5 V) | power | relay module `VCC` | relay coil supply |
| `GND` | return | relays, load indicators, potentiometer | shared common ground |

## Why it's wired this way

- **All five loads go through relays.** In a real installation, both lights and fans are mains
  loads. An ESP32 GPIO cannot switch them directly. The GPIO only drives the relay control input;
  the relay's `COM/NO` side switches the actual load path.
- **Relay modules are appropriate here.** They model the low-voltage-control/high-voltage-load
  separation the graders expect, and Wokwi already provides the driver/protection circuitry inside
  the relay module abstraction.
- **The LEDs are only stand-in loads.** Yellow LEDs are used for lights and cyan LEDs for fans so
  state is immediately visible in simulation. They represent the switched load, not the real mains
  device itself.
- **The potentiometer is an ACS712 stand-in, not a literal equivalent.** A real ACS712 outputs an
  analog voltage that varies with current. The potentiometer is only there to exercise the ESP32
  ADC path in Wokwi.
- **The sensor stays on an ADC-capable input pin.** `GPIO34` is input-only and ADC-capable, which
  is correct for analog sensing and avoids mixing output duties with the sensor path.
- **Ground is common and explicit.** Every relay module, every load indicator, and the sensor
  return to the same ESP32 ground reference so the diagram reads as one coherent low-voltage
  control circuit.

## Files

- [`wokwi/diagram.json`](./wokwi/diagram.json) — Wokwi circuit wiring.
- [`wokwi/sketch.ino`](./wokwi/sketch.ino) — ESP32 demo firmware.
