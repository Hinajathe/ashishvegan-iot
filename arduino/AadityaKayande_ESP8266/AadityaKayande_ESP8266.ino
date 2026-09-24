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
  Backend: Render Cloud (https://ashishvegan-iot.onrender.com)
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
#include <WiFiClientSecure.h>
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
// 2. NETWORK & RENDER SERVER CONFIGURATION
// ------------------------------------------------------------------------------------
const char* ssid     = "IoT";
const char* password = "12345678";

// Live Render Cloud URL (HTTPS Supported)
const String SERVER_URL = "https://ashishvegan-iot.onrender.com";

// Timing intervals
unsigned long lastSensorPushTime = 0;
const unsigned long SENSOR_INTERVAL = 10000; // Push sensor data every 10 seconds

unsigned long lastDevicePollTime = 0;
const unsigned long POLL_INTERVAL = 4000;    // Poll LED & LCD state every 4 seconds (safe for SSL)

// Tracking previous state to avoid LCD flicker
String lastLcdRow1 = "";
String lastLcdRow2 = "";

// ------------------------------------------------------------------------------------
// HELPER: APPLY HARDWARE STATE (LED & LCD)
// ------------------------------------------------------------------------------------
void applyDeviceState(int ledState, String row1, String row2) {
  // 1. Control LED on Pin D6
  digitalWrite(LEDPIN, ledState == 1 ? HIGH : LOW);
  Serial.print(F("[ACTION] LED Pin D6 set to: "));
  Serial.println(ledState == 1 ? F("HIGH (ON)") : F("LOW (OFF)"));

  // 2. Format & update LCD screen
  if (row1.length() == 0 && row2.length() == 0) {
    row1 = "Aaditya Kayande";
    row2 = "System Ready";
  }

  // Pad strings to 16 characters to cleanly overwrite old characters without artifacts
  while (row1.length() < 16) row1 += " ";
  while (row2.length() < 16) row2 += " ";
  row1 = row1.substring(0, 16);
  row2 = row2.substring(0, 16);

  // Update screen only if text has changed to prevent LCD flicker
  if (row1 != lastLcdRow1 || row2 != lastLcdRow2) {
    lcd.setCursor(0, 0);
    lcd.print(row1);
    lcd.setCursor(0, 1);
    lcd.print(row2);

    lastLcdRow1 = row1;
    lastLcdRow2 = row2;

    Serial.print(F("[ACTION] LCD Updated -> [R1]: '"));
    Serial.print(row1);
    Serial.print(F("' | [R2]: '"));
    Serial.print(row2);
    Serial.println(F("'"));
  }
}

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
  Serial.print(F("  Target Render URL: "));
  Serial.println(SERVER_URL);
  Serial.println(F("=================================================="));

  // Initialize LED Pin
  pinMode(LEDPIN, OUTPUT);
  
  // LED Self-Test Blink on Startup: verify hardware wiring on D6!
  Serial.println(F("[HARDWARE] Testing LED on Pin D6..."));
  digitalWrite(LEDPIN, HIGH);
  delay(300);
  digitalWrite(LEDPIN, LOW);
  delay(200);
  digitalWrite(LEDPIN, HIGH);
  delay(300);
  digitalWrite(LEDPIN, LOW);

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
    Serial.println(F("WiFi Connection Failed! Check SSID/Password."));
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
  lcd.print("Render Ready");
  lastLcdRow1 = "Aaditya Kayande ";
  lastLcdRow2 = "Render Ready    ";
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

  // 1. Task 1: Read DHT11 and send sensor data every 10 seconds (also syncs LED/LCD!)
  if (currentMillis - lastSensorPushTime >= SENSOR_INTERVAL) {
    lastSensorPushTime = currentMillis;
    readAndSendSensorData();
  }

  // 2. Task 2: Poll server for LED & LCD updates every 4 seconds
  if (currentMillis - lastDevicePollTime >= POLL_INTERVAL) {
    lastDevicePollTime = currentMillis;
    pollDeviceState();
  }
}

// ------------------------------------------------------------------------------------
// 1. SENSOR PUSH ROUTINE (DHT11 every 10 seconds + 2-Way State Sync)
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

  HTTPClient http;
  http.setTimeout(12000); // 12 seconds timeout to accommodate Render cloud latency
  http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);

  String endpoint = SERVER_URL + "/api/sensor-data";
  bool postSuccess = false;
  String responsePayload = "";

  // Static JSON Document for payload
  StaticJsonDocument<256> doc;
  doc["temperature"] = temperature;
  doc["humidity"] = humidity;

  String jsonPayload;
  serializeJson(doc, jsonPayload);

  if (SERVER_URL.startsWith("https://")) {
    WiFiClientSecure secureClient;
    secureClient.setInsecure(); // Bypass SSL cert validation
    secureClient.setBufferSizes(2048, 512); // 2048 rx buffer accommodates Cloudflare TLS records

    if (http.begin(secureClient, endpoint)) {
      http.addHeader("Content-Type", "application/json");
      int httpCode = http.POST(jsonPayload);

      if (httpCode > 0) {
        Serial.print(F("[Render HTTPS] Sensor Push Status: "));
        Serial.println(httpCode);
        responsePayload = http.getString();
        postSuccess = true;
      } else {
        Serial.print(F("[Render HTTPS] POST Error: "));
        Serial.println(http.errorToString(httpCode));
      }
      http.end();
    }
  } else {
    WiFiClient client;
    if (http.begin(client, endpoint)) {
      http.addHeader("Content-Type", "application/json");
      int httpCode = http.POST(jsonPayload);

      if (httpCode > 0) {
        Serial.print(F("[Render HTTP] Sensor Push Status: "));
        Serial.println(httpCode);
        responsePayload = http.getString();
        postSuccess = true;
      } else {
        Serial.print(F("[Render HTTP] POST Error: "));
        Serial.println(http.errorToString(httpCode));
      }
      http.end();
    }
  }

  // Parse 2-Way Sync Response: Server returns current LED & LCD state directly!
  if (postSuccess && responsePayload.length() > 0) {
    StaticJsonDocument<512> respDoc;
    DeserializationError err = deserializeJson(respDoc, responsePayload);
    if (!err) {
      if (respDoc.containsKey("led") && respDoc.containsKey("lcd_row1")) {
        int ledState = respDoc["led"].as<int>();
        String r1 = respDoc["lcd_row1"].as<String>();
        String r2 = respDoc["lcd_row2"].as<String>();
        applyDeviceState(ledState, r1, r2);
      }
    }
  }

  if (!postSuccess) {
    Serial.println(F("[Render] Failed to push sensor reading to server."));
  }
}

// ------------------------------------------------------------------------------------
// 2. DEVICE STATE POLL ROUTINE (LED & LCD state every 4 seconds)
// ------------------------------------------------------------------------------------
void pollDeviceState() {
  HTTPClient http;
  http.setTimeout(8000);
  http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);

  String endpoint = SERVER_URL + "/api/device/state";
  int httpCode = -1;
  String payload = "";

  if (SERVER_URL.startsWith("https://")) {
    WiFiClientSecure secureClient;
    secureClient.setInsecure();
    secureClient.setBufferSizes(2048, 512); // 2048 rx buffer avoids SSL buffer truncation

    if (http.begin(secureClient, endpoint)) {
      httpCode = http.GET();
      if (httpCode == HTTP_CODE_OK) {
        payload = http.getString();
      } else {
        Serial.print(F("[Poll HTTPS] GET Status: "));
        Serial.print(httpCode);
        Serial.print(F(" - "));
        Serial.println(http.errorToString(httpCode));
      }
      http.end();
    } else {
      Serial.println(F("[Poll HTTPS] http.begin failed to initialize secure connection."));
    }
  } else {
    WiFiClient client;
    if (http.begin(client, endpoint)) {
      httpCode = http.GET();
      if (httpCode == HTTP_CODE_OK) {
        payload = http.getString();
      }
      http.end();
    }
  }

  // If successfully received state, parse and apply immediately
  if (httpCode == HTTP_CODE_OK && payload.length() > 0) {
    StaticJsonDocument<512> doc;
    DeserializationError error = deserializeJson(doc, payload);

    if (!error) {
      int ledState = doc["led"].as<int>();
      String newRow1 = doc["lcd_row1"].as<String>();
      String newRow2 = doc["lcd_row2"].as<String>();

      applyDeviceState(ledState, newRow1, newRow2);
    } else {
      Serial.print(F("[JSON Poll] Parse error: "));
      Serial.println(error.c_str());
    }
  }
}
