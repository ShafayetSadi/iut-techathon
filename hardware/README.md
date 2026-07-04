# Hardware — Representative Room Schematic (Wokwi)

**Deliverable #2 — Hardware/Electrical Schematic.** This is a **simulation/concept only**;
no physical hardware is used and it does **not** feed the running app (the live demo uses
simulated data in the backend). It proves how one room's devices would be *sensed and driven*
in real life.

We model **one representative room** (`work1`) from the fixed device model:
**1 controller (ESP32) + 2 fans (60 W each) + 3 lights (15 W each)**. The other two rooms
are identical, so one room is enough per the problem statement.

## How to open it in Wokwi

1. Go to <https://wokwi.com/projects/new/esp32>.
2. Replace `diagram.json` with [`wokwi/diagram.json`](./wokwi/diagram.json).
3. Replace `sketch.ino` with [`wokwi/sketch.ino`](./wokwi/sketch.ino).
4. Press **▶ (play)**. Flip the slide switches: light LEDs turn on, fan relays click and light
   their indicator LEDs, and the Serial Monitor prints a JSON status line matching the backend
   device model.
5. Take a screenshot of the running circuit and save it as `hardware/schematic.png`
   (or paste the Wokwi **Save & Share** link here and in the root README).

## What the ESP32 does (`controller-1`)

- **Reads device state** — each fan/light has a wall switch (slide switch) wired to a GPIO.
  The controller reads on/off intent, exactly like a real controller watching the room.
- **Drives a stand-in load** so state is visible: LEDs for lights; **relay modules** for
  fans (the relay switches an indicator LED that represents the fan's mains power).
- **Senses current draw** (optional/bonus) — a potentiometer on an ADC pin stands in for an
  **ACS712 hall-effect current sensor** clamped on the room's supply line.
- **Reports upstream** — prints a per-second JSON line in the same shape the backend uses
  (`room`, `controller`, `loads_on`, per-device `on`/`off`, power), showing how a real
  controller would report into the backend that both the dashboard and Discord bot read.

## Pin map

| ESP32 pin | Direction | Connected to | Represents |
|-----------|-----------|--------------|------------|
| `D13` | input (pulldown) | slide switch | `light-1` on/off |
| `D14` | input (pulldown) | slide switch | `light-2` on/off |
| `D27` | input (pulldown) | slide switch | `light-3` on/off |
| `D26` | input (pulldown) | slide switch | `fan-1` on/off |
| `D25` | input (pulldown) | slide switch | `fan-2` on/off |
| `D18` | output | 220 Ω → LED | `light-1` load |
| `D19` | output | 220 Ω → LED | `light-2` load |
| `D21` | output | 220 Ω → LED | `light-3` load |
| `D22` | output | relay `IN` | `fan-1` relay driver |
| `D23` | output | relay `IN` | `fan-2` relay driver |
| `VP` (GPIO36, ADC1) | analog in | potentiometer wiper | room current sensor (ACS712 stand-in) |
| `3V3` / `GND` | power | switches, LEDs, pot, relay switched side | reference rails |
| `VIN` (5 V) | power | relay coils (`VCC`) | relay supply |

## Why it's wired this way (electrical reasoning)

- **Switches use `INPUT_PULLDOWN`.** The switch feeds `3V3` to the GPIO when ON and the
  internal pulldown holds it at `0 V` when OFF — a clean, defined logic level with no
  floating input and no external resistor.
- **LEDs have 220 Ω series resistors.** A GPIO drives an LED directly, but the resistor
  limits current to a safe ~10–15 mA so neither the LED nor the pin is damaged.
- **Fans are switched through relay modules, not the GPIO.** A real ceiling fan runs on mains
  power, which an ESP32 pin cannot switch. The GPIO drives the relay's `IN` control pin; the
  relay's isolated `COM`/`NO` contacts switch the fan circuit (an indicator LED here). The
  relay module has its own coil driver and flyback protection on board, so no discrete
  transistor or diode is needed. (Wokwi's parts library has no plain DC motor / discrete BJT /
  diode, so the relay module is both the more realistic and the Wokwi-supported choice.)
- **Current sensing is analog on ADC1 (`VP`/GPIO36).** A real ACS712 outputs ~2.5 V at 0 A and
  swings with load; the potentiometer emulates that varying analog signal so the firmware's
  read/scale path is demonstrated. (ADC1 is used because ADC2 pins conflict with WiFi.)

## Files

- [`wokwi/diagram.json`](./wokwi/diagram.json) — the wiring (import into Wokwi).
- [`wokwi/sketch.ino`](./wokwi/sketch.ino) — the ESP32 firmware.
