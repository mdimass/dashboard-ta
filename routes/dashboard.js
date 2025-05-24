// Import library yang dibutuhkan
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

// URL broker MQTT menggunakan WebSocket Secure
const brokerUrl =
  "wss://3107ee96d14c4007908cdd3e772e6600.s1.eu.hivemq.cloud:8884/mqtt";

// Membuat koneksi MQTT
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

// Ekspor router
module.exports = function (db) {
  // GET: Homepage (dashboard jika ada user)
  router.get("/", function (req, res, next) {
    db.query("SELECT * FROM users", (err, data) => {
      if (err) {
        console.log(err);
        return res.send(err);
      }

      if (data.rows.length > 0) {
        req.session.user = data.rows[0];
        return res.render("dashboard/dashboard", { title: "Polines" });
      }

      return res.redirect("/");
    });
  });

  // GET: Kirim semua data user dan publish ke MQTT
  router.get("/users", function (req, res, next) {
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
  router.post("/", function (req, res, next) {
    const {
      mode = null,
      kp = null,
      ki = null,
      kd = null,
      set_point = null,
      set_point2 = null,
      time_sampling = null,
      nama_pengguna = null,
    } = req.body;

    console.log("Received values:", {
      mode,
      kp,
      ki,
      kd,
      set_point,
      set_point2,
      time_sampling,
      nama_pengguna,
    });

    const ensureUserSession = () =>
      new Promise((resolve, reject) => {
        if (req.session.user) {
          resolve(req.session.user);
        } else {
          db.query("SELECT * FROM users LIMIT 1", (err, data) => {
            if (err) reject(err);
            else if (data.rows.length > 0) {
              req.session.user = data.rows[0];
              resolve(req.session.user);
            } else {
              resolve(null);
            }
          });
        }
      });

    ensureUserSession()
      .then((user) => {
        if (!user) return res.redirect("/");

        const values = [
          set_point || "0",
          kp === "" ? "0" : kp,
          ki === "" ? "0" : ki,
          kd === "" ? "0" : kd,
          time_sampling || "0",
          mode,
          set_point2 === "" ? "0" : set_point2,
          nama_pengguna || "unknown",
          user.id_user,
        ];

        // Validasi input minimal
        for (let i = 0; i < 5; i++) {
          if (values[i] === null || values[i] === "") {
            return res.status(400).send(`Invalid input for parameter ${i + 1}`);
          }
        }

        const query = `
          UPDATE users
          SET setpoint = $1, kp = $2, ki = $3, kd = $4, time_sampling = $5, 
              mode_kendali = $6, setpoint2 = $7, nama_pengguna = $8
          WHERE id_user = $9
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
            nama_pengguna: values[7],
            user_id: values[8],
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
      })
      .catch((err) => {
        console.error("Session or DB error:", err);
        res.status(500).send("Internal Server Error");
      });
  });

  return router;
};
