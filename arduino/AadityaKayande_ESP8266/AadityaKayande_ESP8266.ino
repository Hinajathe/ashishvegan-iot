/*
 ======================================================================================
  Project: Aaditya Kayande - IoT Environmental Monitoring & Hardware Automation
  Developed by: Hina Jathe, Dept. of Electrical Engineering, Government college of Engg yavatmal
  Hardware Components:
    - Microcontroller: ESP8266 (NodeMCU / WeMos D1)
    - Temperature & Humidity: DHT11 on Pin D5 (GPIO 14)
    - LED Control: Pin D6 (GPIO 12)
    - Smart Display: 16x2 I2C LCD on Pin D1 (SCL / GPIO 5) & Pin D2 (SDA / GPIO 4)
  WiFi Configuration:
    - SSID: IoT
    - Password: 12345678
  Backend: Node.js + Express + SQLite (Render Deployable)
 ======================================================================================
  Required Arduino IDE Libraries:
    1. ESP8266 Board Package (by ESP8266 Community)
    2. DHT sensor library (by Adafruit) + Adafruit Unified Sensor
    3. LiquidCrystal_I2C (by Frank de Brabander or Marco Schwartz)
    4. ArduinoJson (v6.x or v7.x by Benoit Blanchon)
 ======================================================================================
*/

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>
#include <DHT.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <ArduinoJson.h>

// ------------------------------------------------------------------------------------
// 1. HARDWARE PIN DEFINITIONS
// ------------------------------------------------------------------------------------
#define DHTPIN   D5     // DHT11 Data Pin (GPIO 14)
#define DHTTYPE  DHT11  // Sensor type DHT11
#define LEDPIN   D6     // LED Digital Output (GPIO 12)

// I2C Pins for ESP8266:
// D1 = SCL (GPIO 5)
// D2 = SDA (GPIO 4)
// Standard I2C addresses are 0x27 or 0x3F for 16x2 LCD
LiquidCrystal_I2C lcd(0x27, 16, 2); 

// Initialize DHT
DHT dht(DHTPIN, DHTTYPE);

// ------------------------------------------------------------------------------------
// 2. NETWORK & SERVER CONFIGURATION
// ------------------------------------------------------------------------------------
const char* ssid     = "IoT";
const char* password = "12345678";

// Set your Backend Server URL:
// For Local Testing: "http://<YOUR_COMPUTER_LOCAL_IP>:3000" (e.g. "http://192.168.1.15:3000")
// For Render Cloud:   "https://<your-render-app-name>.onrender.com"
const String SERVER_URL = "http://192.168.1.100:3000"; // <-- Replace with your local IP or Render URL

// Timing intervals
unsigned long lastSensorPushTime = 0;
const unsigned long SENSOR_INTERVAL = 10000; // Push sensor data every 10 seconds (10,000 ms)

unsigned long lastDevicePollTime = 0;
const unsigned long POLL_INTERVAL = 2000;    // Poll LED & LCD state every 2 seconds (2,000 ms)

// Tracking previous state to avoid LCD flicker
String lastLcdRow1 = "";
String lastLcdRow2 = "";

// ------------------------------------------------------------------------------------
// SETUP
// ------------------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println();
  Serial.println(F("=================================================="));
  Serial.println(F("  Aaditya Kayande IoT System Initializing...      "));
  Serial.println(F("  Dept of Electrical Engg, GCOE Yavatmal          "));
  Serial.println(F("=================================================="));

  // Initialize LED Pin
  pinMode(LEDPIN, OUTPUT);
  digitalWrite(LEDPIN, LOW); // Start with LED OFF

  // Initialize I2C communication (SDA = D2, SCL = D1)
  Wire.begin(D2, D1);

  // Initialize LCD Screen
  lcd.init();
  lcd.backlight();
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Aaditya Kayande");
  lcd.setCursor(0, 1);
  lcd.print("Connecting WiFi.");

  // Initialize DHT sensor
  dht.begin();

  // Connect to WiFi
  Serial.print(F("Connecting to WiFi: "));
  Serial.println(ssid);
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.println(F("WiFi Connected successfully!"));
    Serial.print(F("IP Address: "));
    Serial.println(WiFi.localIP());

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("WiFi Connected!");
    lcd.setCursor(0, 1);
    lcd.print(WiFi.localIP());
    delay(2000);
  } else {
    Serial.println();
    Serial.println(F("WiFi Connection Failed! Running in standalone mode."));
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("WiFi Failed!");
    lcd.setCursor(0, 1);
    lcd.print("Check SSID/Pass");
    delay(2000);
  }

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Aaditya Kayande");
  lcd.setCursor(0, 1);
  lcd.print("System Ready");
  lastLcdRow1 = "Aaditya Kayande";
  lastLcdRow2 = "System Ready";
}

// ------------------------------------------------------------------------------------
// MAIN LOOP
// ------------------------------------------------------------------------------------
void loop() {
  unsigned long currentMillis = millis();

  // Reconnect WiFi if disconnected
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println(F("WiFi disconnected! Attempting reconnection..."));
    WiFi.reconnect();
    delay(1000);
    return;
  }

  // 1. Task 1: Read DHT11 and send sensor data every 10 seconds
  if (currentMillis - lastSensorPushTime >= SENSOR_INTERVAL) {
    lastSensorPushTime = currentMillis;
    readAndSendSensorData();
  }

  // 2. Task 2: Poll server for LED & LCD updates every 2 seconds
  if (currentMillis - lastDevicePollTime >= POLL_INTERVAL) {
    lastDevicePollTime = currentMillis;
    pollDeviceState();
  }
}

// ------------------------------------------------------------------------------------
// 1. SENSOR PUSH ROUTINE (DHT11 every 10 seconds)
// ------------------------------------------------------------------------------------
void readAndSendSensorData() {
  float humidity = dht.readHumidity();
  float temperature = dht.readTemperature(); // Celsius

  // Check if readings failed
  if (isnan(humidity) || isnan(temperature)) {
    Serial.println(F("[DHT11] Warning: Failed to read from DHT11 sensor! Checking connections on D5..."));
    return;
  }

  Serial.print(F("[DHT11] Temperature: "));
  Serial.print(temperature, 1);
  Serial.print(F(" °C | Humidity: "));
  Serial.print(humidity, 1);
  Serial.println(F(" %"));

  WiFiClient client;
  HTTPClient http;

  String endpoint = SERVER_URL + "/api/sensor-data";
  if (http.begin(client, endpoint)) {
    http.addHeader("Content-Type", "application/json");

    // Construct JSON payload
    StaticJsonDocument<128> doc;
    doc["temperature"] = temperature;
    doc["humidity"] = humidity;

    String jsonPayload;
    serializeJson(doc, jsonPayload);

    int httpCode = http.POST(jsonPayload);
    if (httpCode > 0) {
      Serial.print(F("[HTTP] Sensor Data POST Status: "));
      Serial.println(httpCode);
    } else {
      Serial.print(F("[HTTP] POST error: "));
      Serial.println(http.errorToString(httpCode));
    }
    http.end();
  } else {
    Serial.println(F("[HTTP] Unable to connect to backend server."));
  }
}

// ------------------------------------------------------------------------------------
// 2. DEVICE STATE POLL ROUTINE (LED & LCD state every 2 seconds)
// ------------------------------------------------------------------------------------
void pollDeviceState() {
  WiFiClient client;
  HTTPClient http;

  String endpoint = SERVER_URL + "/api/device/state";
  if (http.begin(client, endpoint)) {
    int httpCode = http.GET();

    if (httpCode == HTTP_CODE_OK) {
      String payload = http.getString();

      StaticJsonDocument<384> doc;
      DeserializationError error = deserializeJson(doc, payload);

      if (!error) {
        // 1. Process LED Automation (Tab 3)
        int ledState = doc["led"] | 0;
        digitalWrite(LEDPIN, ledState == 1 ? HIGH : LOW);

        // 2. Process Smart LCD Display (Tab 2)
        const char* rawRow1 = doc["lcd_row1"] | "";
        const char* rawRow2 = doc["lcd_row2"] | "";

        String newRow1 = String(rawRow1);
        String newRow2 = String(rawRow2);

        // Pad strings to 16 characters to cleanly overwrite old characters without screen artifacts
        while (newRow1.length() < 16) newRow1 += " ";
        while (newRow2.length() < 16) newRow2 += " ";
        newRow1 = newRow1.substring(0, 16);
        newRow2 = newRow2.substring(0, 16);

        // Update screen only if text has changed to prevent LCD flicker
        if (newRow1 != lastLcdRow1 || newRow2 != lastLcdRow2) {
          lcd.setCursor(0, 0);
          lcd.print(newRow1);
          lcd.setCursor(0, 1);
          lcd.print(newRow2);

          lastLcdRow1 = newRow1;
          lastLcdRow2 = newRow2;

          Serial.println(F("[LCD] Updated text on display."));
        }

      } else {
        Serial.print(F("[JSON] Parse error: "));
        Serial.println(error.c_str());
      }
    }
    http.end();
  }
}
