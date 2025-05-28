const express = require("express");
const mqtt = require("mqtt");
const router = express.Router();

let dbClient; // buat referensi global ke db

const mqttOptions = {
  username: "dimas",
  password: "TaEKD2025",
  clientId: "vercel_client_" + Math.random().toString(16).substr(2, 8),
  clean: true,
  reconnectPeriod: 1000,
  connectTimeout: 5000,
};

const brokerUrl =
  "wss://3107ee96d14c4007908cdd3e772e6600.s1.eu.hivemq.cloud:8884/mqtt";
const mqttClient = mqtt.connect(brokerUrl, mqttOptions);

mqttClient.on("connect", () => {
  console.log("Connected to MQTT broker");

  mqttClient.subscribe("RPM/output", (err) => {
    if (err) {
      console.error("Subscribe error:", err);
    } else {
      console.log("Subscribed to RPM/output");
    }
  });
});

mqttClient.on("error", (err) => {
  console.error("MQTT connection error:", err);
});
mqttClient.on("offline", () => {
  console.error("MQTT client went offline");
});
mqttClient.on("close", () => {
  console.log("MQTT connection closed");
});

mqttClient.on("message", (topic, message) => {
  if (topic === "RPM/output") {
    try {
      const data = JSON.parse(message.toString());
      console.log("Received RPM data:", data);

      // Simpan ke database table temporary kolom value
      if (dbClient) {
        const query = `INSERT INTO output (value) VALUES ($1)`;
        dbClient.query(query, [data.rpm], (err) => {
          if (err) {
            console.error("Error inserting RPM to DB:", err);
          } else {
            console.log("RPM data saved to database");
          }
        });
      } else {
        console.error("Database client not initialized");
      }
    } catch (e) {
      console.error("Error parsing RPM data:", e);
    }
  }
});

function ensureAuthenticated(req, res, next) {
  if (req.session.user) return next();
  res.redirect("/");
}

module.exports = function (db) {
  dbClient = db; // assign db client ke variabel global

  router.get("/", ensureAuthenticated, function (req, res) {
    res.render("dashboard/dashboard", { title: "Polines" });
  });

  router.get("/users", ensureAuthenticated, function (req, res) {
    db.query("SELECT * FROM users ORDER BY id_user ASC", (err, result) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).send("Database query error");
      }

      const usersData = result.rows;

      mqttClient.publish(
        "polines/TA2025",
        JSON.stringify(usersData),
        (mqttErr) => {
          if (mqttErr) {
            console.error("Publish error:", mqttErr);
          } else {
            console.log("Data sent to MQTT:", usersData);
          }
        }
      );

      res.json(usersData);
    });
  });

  router.post("/", ensureAuthenticated, function (req, res) {
    const {
      mode = null,
      kp = null,
      ki = null,
      kd = null,
      set_point = null,
      set_point2 = null,
      time_sampling = null,
    } = req.body;

    console.log("Received values:", {
      mode,
      kp,
      ki,
      kd,
      set_point,
      set_point2,
      time_sampling,
    });

    const user = req.session.user;

    const values = [
      set_point || "0",
      kp || "0",
      ki || "0",
      kd || "0",
      time_sampling || "0",
      mode,
      set_point2 || "0",
      user.id_user,
    ];

    for (let i = 0; i < 7; i++) {
      if (values[i] === null || values[i] === "") {
        return res.status(400).send(`Invalid input for parameter ${i + 1}`);
      }
    }

    const query = `
      UPDATE users
      SET setpoint = $1, kp = $2, ki = $3, kd = $4, time_sampling = $5, mode_kendali = $6, setpoint2 = $7
      WHERE id_user = $8
    `;

    db.query(query, values, (err) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).send("Database query error");
      }

      const dataToSend = {
        set_point: values[0],
        kp: values[1],
        ki: values[2],
        kd: values[3],
        time_sampling: values[4],
        mode: values[5],
        set_point2: values[6],
        user_id: values[7],
        nama_pengguna: user.nama_pengguna,
      };

      mqttClient.publish(
        "polines/TA2025",
        JSON.stringify(dataToSend),
        (mqttErr) => {
          if (mqttErr) {
            console.error("Publish error:", mqttErr);
          } else {
            console.log("Data sent:", dataToSend);
          }
        }
      );

      res.status(200).send("Data updated successfully");
    });
  });

  return router;
};
