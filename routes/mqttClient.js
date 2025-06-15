const mqtt = require("mqtt");

const mqttOptions = {
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD,
  clientId: "vercel_client_" + Math.random().toString(16).substr(2, 8),
  clean: true,
  reconnectPeriod: 1000,
  connectTimeout: 5000,
};

const brokerUrl =
  "wss://3107ee96d14c4007908cdd3e772e6600.s1.eu.hivemq.cloud:8884/mqtt";
const mqttClient = mqtt.connect(brokerUrl, mqttOptions);

// Penanganan koneksi MQTT
mqttClient.on("connect", () => {
  console.log("Connected to MQTT broker");

  mqttClient.subscribe("RPM/output/#", (err) => {
    if (err) {
      console.error("Subscribe error:", err);
    } else {
      console.log("Subscribed to RPM/output/#");
    }
  });
});

mqttClient.on("error", (err) => console.error("MQTT error:", err));
mqttClient.on("offline", () => console.error("MQTT client offline"));
mqttClient.on("close", () => console.log("MQTT connection closed"));

module.exports = mqttClient;
