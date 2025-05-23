var express = require("express");
var mqtt = require("mqtt");
var router = express.Router();

const mqttOptions = {
  username: "dimas", // sesuaikan
  password: "TaEKD2025", // sesuaikan
  clientId: "vercel_client_" + Math.random().toString(16).substr(2, 8),
  clean: true,
  reconnectPeriod: 1000,
  connectTimeout: 5000,
};

const brokerUrl =
  "wss://3107ee96d14c4007908cdd3e772e6600.s1.eu.hivemq.cloud:8884/mqtt";

// Buat koneksi MQTT satu kali (singleton)
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

  router.get("/users", function (req, res, next) {
    db.query("SELECT * FROM users ORDER BY id_user ASC", (err, result) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).send("Database query error");
      }

      const usersData = result.rows;

      // Publish data ke MQTT (tidak perlu koneksi ulang)
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

  router.post("/", function (req, res, next) {
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

    // Pastikan user session sudah ada sebelum update
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
        if (!user) {
          return res.redirect("/");
        }

        const values = [
          set_point || "0",
          kp === "" ? "0" : kp,
          ki === "" ? "0" : ki,
          kd === "" ? "0" : kd,
          time_sampling || "0",
          mode,
          set_point2 === "" ? "0" : set_point2,
          user.id_user,
        ];

        for (let i = 0; i < 5; i++) {
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
          };

          // Publish ke MQTT, koneksi sudah ada
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
