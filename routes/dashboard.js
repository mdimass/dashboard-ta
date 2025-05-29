var express = require("express");
var mqtt = require("mqtt");
var router = express.Router();

// Konfigurasi koneksi MQTT
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

module.exports = function (db) {
  // Middleware: Cek apakah user sudah login
  router.use((req, res, next) => {
    if (!req.session.user) {
      return res.redirect("/");
    }
    next();
  });

  // GET: Tampilkan halaman dashboard
  router.get("/", function (req, res) {
    res.render("dashboard/dashboard", { title: "Polines" });
  });

  // GET: Ambil semua data user dan kirim via MQTT
  router.get("/users", function (req, res) {
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

  // POST: Update data kontrol
  router.post("/", function (req, res) {
    const {
      mode = null,
      kp = null,
      ki = null,
      kd = null,
      set_point = null,
      set_point2 = null,
      time_sampling = null,
    } = req.body;

    const user = req.session.user;
    if (!user) {
      return res.redirect("/");
    }

    const values = [
      set_point === "" ? "0" : set_point,
      kp === "" ? "0" : kp,
      ki === "" ? "0" : ki,
      kd === "" ? "0" : kd,
      time_sampling || "0",
      mode,
      set_point2 === "" ? "0" : set_point2,
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

    db.query(query, values, (err, result) => {
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
