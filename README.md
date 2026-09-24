# Aaditya Kayande - IoT Environmental Monitoring & Hardware Automation

**Designed and Developed by Hina Jathe**  
*Dept. of Electrical Engineering, Government College of Engineering, Yavatmal*

---

## 🌟 Overview
A complete, end-to-end Internet of Things (IoT) web application and hardware system built for real-time environmental monitoring, smart display management, and remote actuator automation.

- **Microcontroller**: ESP8266 (NodeMCU / WeMos D1)
- **Sensor**: DHT11 Temperature & Humidity Sensor (Pin D5)
- **Actuator**: LED Indicator (Pin D6)
- **Display**: 16x2 LCD with I2C Module (Pins D1 SCL, D2 SDA)
- **Web Frontend**: HTML5 + Tailwind CSS (Green Theme) + Chart.js + Font Awesome Icons
- **Web Backend**: Node.js + Express + SQLite Database
- **Timezone**: `+5:30 Asia/Kolkata`
- **Cloud Hosting**: Render Deployable (`render.yaml` ready)

---

## 🚀 Features

### 1. Tab 1: Environment Monitoring
- **DHT11 Auto-logging**: Captures temperature & humidity readings automatically every 10 seconds.
- **Innovative Gauges & Seek Bars**:
  - Circular Arc Speedometer gauge with smooth SVG gradient transitions.
  - Linear Seek Bar / Thermal & Moisture sliders with live position pointers and color status badges (*Cool, Optimal, Warm, Hot Alert / Dry, Comfortable, High Moisture*).
- **Interactive Trend Curves**: Real-time dual-axis Chart.js graph tracking temperature and humidity fluctuations over time.
- **Saved Records Table**:
  - Shows `# Record | Temperature | Humidity | Time (IST) | Date | Action (Delete)`
  - Pagination: Shows latest records first, 20 records at a time.
  - One-click record deletion and Export to CSV functionality.
- **Built-in DHT11 Push Simulator**: Test gauges, graphs, and database logging directly from the dashboard even before connecting hardware!

### 2. Tab 2: Smart LCD
- Inputs for **Row 1** and **Row 2** with real-time 16-character counter.
- **Authentic 16x2 HD44780 LCD Simulator**: Green backlit matrix display giving instant visual feedback of what appears on the physical LCD.
- Quick preset buttons (*Kayande Lab, GCOE Yavatmal, Status Normal, Clear LCD*).
- Upon clicking **Update**, the ESP8266 polls and updates the physical screen within 2 seconds.

### 3. Tab 3: LED Automation
- Interactive toggle switch turning the physical LED on Pin D6 ON / OFF.
- Realistic pulsing neon-green LED diode visualizer.
- Instant synchronization with SQLite and ESP8266 polling.

### 4. User Authentication
- Complete Login & Registration system with password hashing (`bcryptjs`) and secure JWT session tokens (`jsonwebtoken`).

---

## 🔌 Hardware Wiring Diagram

| Component | Component Pin | ESP8266 Pin | Notes |
| :--- | :--- | :--- | :--- |
| **DHT11 Sensor** | VCC | 3.3V or VIN | Power supply |
| | GND | GND | Ground |
| | DATA | **D5** (GPIO 14) | Digital reading pin |
| **LED** | Anode (+) | **D6** (GPIO 12) | Connected via 220Ω resistor |
| | Cathode (-) | GND | Ground |
| **16x2 I2C LCD** | VCC | VIN (5V) | LCD backlight needs 5V |
| | GND | GND | Ground |
| | SCL | **D1** (GPIO 5) | I2C Clock |
| | SDA | **D2** (GPIO 4) | I2C Data |

---

## 📶 WiFi & ESP8266 Firmware Configuration

1. Open `arduino/AadityaKayande_ESP8266.ino` in the **Arduino IDE**.
2. Install required libraries via Arduino Library Manager (`Ctrl + Shift + I`):
   - `DHT sensor library` (Adafruit)
   - `Adafruit Unified Sensor`
   - `LiquidCrystal_I2C` (Frank de Brabander / Marco Schwartz)
   - `ArduinoJson` (Benoit Blanchon, v6 or v7)
3. Ensure the ESP8266 Board package is installed (Tools -> Board -> ESP8266 Boards -> NodeMCU 1.0).
4. WiFi settings are pre-configured:
   - **SSID**: `IoT`
   - **Password**: `12345678`
5. In `arduino/AadityaKayande_ESP8266.ino`, set `SERVER_URL`:
   - For local testing: `http://192.168.x.x:3000` (Your computer's local IP address)
   - For Render cloud: `https://your-app-name.onrender.com`
6. Select your COM port and click **Upload**.

---

## 💻 Running the Web Application Locally

```bash
# 1. Install dependencies
npm install

# 2. Start the server
npm start
```
The server will start at: **`http://localhost:3000`**

---

## ☁️ Deploying to Render (Free Cloud Hosting)

This project is 100% Render-ready.

### Steps:
1. Push this project folder to your **GitHub** repository.
2. Sign in to [Render](https://render.com).
3. Click **New +** &rarr; **Web Service**.
4. Connect your GitHub repository.
5. Configure the deployment settings:
   - **Name**: `aaditya-kayande-iot`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: `Free`
6. Click **Deploy Web Service**!
7. Once deployed, copy your Render URL (e.g., `https://aaditya-kayande-iot.onrender.com`) and paste it into `SERVER_URL` in the Arduino code!

---

## 📂 Project Structure

```
IOT project/
├── arduino/
│   └── AadityaKayande_ESP8266.ino   # Complete ESP8266 firmware sketch
├── public/
│   ├── index.html                   # Responsive Tailwind CSS frontend
│   ├── css/
│   │   └── style.css                # Green theme, gauges, LCD & LED styles
│   └── js/
│       └── app.js                   # Live polling, charts, gauges, LCD & LED logic
├── .env.example                     # Environment template
├── .gitignore                       # Git ignore list
├── database.js                      # SQLite database initialization & queries
├── package.json                     # Node.js dependencies & scripts
├── render.yaml                      # 1-click Render blueprint configuration
├── server.js                        # Express.js REST API server
└── README.md                        # Documentation
```
