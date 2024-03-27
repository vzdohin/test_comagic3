let ua;
let currentSession = null;
let callTimer = null;

// Событие загрузки DOM
document.addEventListener("DOMContentLoaded", function () {
  restoreCredentialsAndLogin();
  setupEndCallButton();
  showCallHistory();
});

// Обновление статуса звонка в UI
function updateCallStatus(status) {
  document.getElementById("call-status-text").textContent = status;
}

// Скрытие UI входящего звонка
function hideIncomingCallUI() {
  document.getElementById("incoming-call").style.display = "none";
}

// Обработка входящего звонка
function handleIncomingCall(session) {
  currentSession = session;
  updateCallStatus("Входящий звонок...");
  document.getElementById("incoming-call").style.display = "block";
  document.getElementById("call-info").style.display = "none";
  document.getElementById("incoming-number").textContent =
    session.remote_identity.uri.user;

  document.getElementById("answer-button").onclick = function () {
    acceptCall(session);
  };
  document.getElementById("decline-button").onclick = function () {
    declineCall(session);
  };
}

// Принятие входящего звонка
function acceptCall(session) {
  session.answer({ mediaConstraints: { audio: true, video: false } });
  updateCallStatus("Вызов принят");
  document.getElementById("call-info").style.display = "block";
  document.getElementById("call-details").style.display = "block";
  document.getElementById("end-call-button").style.display = "block";
  startCallTimer();
  hideIncomingCallUI();
}

// Отклонение входящего или исходящего звонка
function declineCall(session) {
  session.terminate();
  hideIncomingCallUI();
}

// Сохранение учетных данных пользователя
function saveCredentials(server, login, password) {
  chrome.storage.local.set({ server, login, password });
}

// Выход из аккаунта
function logout() {
  if (ua) {
    ua.stop();
    ua = null;
  }
  chrome.storage.local.remove(["login", "server", "password"], function () {
    resetCallUI();
    document.getElementById("login-form").style.display = "block";
    document.getElementById("logout-button").style.display = "none";
    updateCallStatus("Неактивен");
  });
}

// Таймер
function startCallTimer() {
  if (callTimer) clearInterval(callTimer);

  const startTime = Date.now();
  callTimer = setInterval(() => {
    const elapsedTime = Date.now() - startTime;
    document.getElementById("call-duration").textContent =
      formatDuration(elapsedTime);
  }, 1000);
}

function stopCallTimer() {
  clearInterval(callTimer);
  document.getElementById("call-duration").textContent = "00:00:00";
}

// Форматирование продолжительности звонка
function formatDuration(milliseconds) {
  let totalSeconds = Math.floor(milliseconds / 1000);
  let hours = Math.floor(totalSeconds / 3600);
  let minutes = Math.floor((totalSeconds % 3600) / 60);
  let seconds = totalSeconds % 60;

  hours = String(hours).padStart(2, "0");
  minutes = String(minutes).padStart(2, "0");
  seconds = String(seconds).padStart(2, "0");

  return `${hours}:${minutes}:${seconds}`;
}

// Попытка авторизации и регистрации на SIP сервере
function attemptLogin(server, login, password) {
  if (!ua) {
    const socket = new JsSIP.WebSocketInterface(`wss://${server}`);
    const configuration = {
      sockets: [socket],
      uri: `sip:${login}@${server}`,
      password: password,
      display_name: login,
      pcConfig: {
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      },
    };
    ua = new JsSIP.UA(configuration);
    ua.start();

    ua.on("registered", function () {
      updateCallStatus("Зарегистрирован");
      document.getElementById("login-form").style.display = "none";
      document.getElementById("logout-button").style.display = "block";
      saveCredentials(server, login, password);
      showCallHistory();
    });

    ua.on("registrationFailed", function (e) {
      updateCallStatus("Регистрация не удалась: " + e.cause);
    });

    setupSessionHandlers();
  }
}

// Восстановление учетных данных и автоматический вход
function restoreCredentialsAndLogin() {
  chrome.storage.local.get(["server", "login", "password"], function (data) {
    if (data.server && data.login && data.password) {
      attemptLogin(data.server, data.login, data.password);
    }
  });
}

// Настройка обработчиков сессии
function setupSessionHandlers() {
  ua.on("newRTCSession", function (data) {
    const session = data.session;
    if (session.direction === "incoming") {
      handleIncomingCall(session);
    }

    session.on("progress", function () {
      updateCallStatus("Вызов в процессе...");
    });

    session.on("accepted", function () {
      updateCallStatus("Вызов принят");
      document.getElementById("call-info").style.display = "block";
      document.getElementById("end-call-button").style.display = "block";
      document.getElementById("call-number").textContent =
        session.remote_identity.uri.user;
      startCallTimer();
    });
    session.on("peerconnection", function (e) {
      const pc = e.peerconnection;
      pc.ontrack = function (event) {
        if (event.track.kind === "audio") {
          const remoteAudio = document.createElement("audio");
          remoteAudio.autoplay = true;
          remoteAudio.srcObject = event.streams[0];
          document.body.appendChild(remoteAudio);
        }
      };
    });

    session.on("ended", function () {
      updateCallStatus("Вызов завершен");
      stopCallTimer();
      const callDetails = {
        type: session.direction === "incoming" ? "Входяший" : "Исходящий",
        number: session.remote_identity.uri.user,
        startTime: new Date(session._start_time).getTime() || Date.now(),
        endTime: new Date(session._end_time).getTime() || Date.now(),
        status: "Завершен",
      };

      // Сохранение истории вызовов
      saveCallHistory(callDetails);
      resetCallUI();
    });

    session.on("failed", function () {
      updateCallStatus("Вызов не удался");
      stopCallTimer();
      const callDetails = {
        type: session.direction === "incoming" ? "Входяший" : "Исходящий",
        number: session.remote_identity.uri.user,
        startTime: session._start_time || Date.now(),
        endTime: new Date(session._end_time).getTime() || Date.now(),
        status: "Отменен",
      };
      saveCallHistory(callDetails);
      resetCallUI();
    });
  });
}

// Обработчик кнопки Позвонить
document.getElementById("call-button").addEventListener("click", function () {
  makeCall(document.getElementById("number").value);
});

// Функция совершения вызова
function makeCall(number) {
  if (ua && ua.isRegistered()) {
    resetCallUI();
    document.getElementById("call-info").style.display = "block";
    currentSession = ua.call(number, {
      mediaConstraints: { audio: true, video: false },
      eventHandlers: {
        progress: function (e) {
          document.getElementById("end-call-button").style.display = "block";
        },
        accepted: function (e) {
          document.getElementById("call-details").style.display = "block";
          startCallTimer();
        },
        peerconnection: function (e) {
          const pc = e.peerconnection;
          pc.ontrack = function (event) {
            if (event.track.kind === "audio") {
              const remoteAudio = document.createElement("audio");
              remoteAudio.autoplay = true;
              remoteAudio.srcObject = event.streams[0];
              document.body.appendChild(remoteAudio);
            }
          };
        },
      },
    });
  } else {
    updateCallStatus("Вы не зарегистрированы на сервере SIP");
  }
}

// Функция сохранения истории вызовов
function saveCallHistory(callDetails) {
  chrome.storage.local.get(["login"], function (data) {
    if (!data.login) {
      console.error("Ошибка: логин пользователя не найден.");
      return;
    }
    const historyKey = "callHistory_" + data.login;
    chrome.storage.local.get([historyKey], function (data) {
      let callHistory = data[historyKey] ? data[historyKey] : [];
      callHistory.unshift(callDetails);

      // Сохранение 20 записей в историю
      if (callHistory.length > 20) {
        callHistory = callHistory.slice(0, 20);
      }
      chrome.storage.local.set({ [historyKey]: callHistory }, function () {
        console.log("История вызовов обновлена.");
        showCallHistory();
      });
    });
  });
}

// Функция отображения истории вызовов
function showCallHistory() {
  chrome.storage.local.get(["login"], function (data) {
    const login = data.login;
    if (!login) {
      console.log("Ошибка: логин пользователя не найден.");
      document.getElementById("call-history").innerHTML =
        "Пожалуйста, войдите в аккаунт, чтобы увидеть историю звонков.";
      return;
    }

    const historyKey = "callHistory_" + login;
    chrome.storage.local.get([historyKey], function (data) {
      const historyElement = document.getElementById("call-history");
      historyElement.innerHTML = "";
      const callHistory = data[historyKey] || [];

      callHistory.forEach(function (call) {
        const startTime = new Date(call.startTime).toLocaleString();
        const endTime = new Date(call.endTime).toLocaleString();
        const callInfo = document.createElement("div");
        callInfo.innerHTML =
          `<strong>${call.number}</strong><br>` +
          `Тип: ${call.type}, <br>` +
          `Начало: ${startTime}, <br>` +
          `Конец: ${endTime}, <br>` +
          `Статус: ${call.status}`;
        historyElement.appendChild(callInfo);
      });
    });
  });
}

// Сброс UI вызова
function resetCallUI() {
  document.getElementById("incoming-call").style.display = "none";
  document.getElementById("call-info").style.display = "none";
  document.getElementById("call-details").style.display = "none";
  document.getElementById("call-duration").textContent = "00:00:00";
  document.getElementById("call-number").textContent = "";
  document.getElementById("end-call-button").style.display = "none";
}

// Настройка обработчика кнопки Закончить вызов
function setupEndCallButton() {
  document
    .getElementById("end-call-button")
    .addEventListener("click", function () {
      if (currentSession) {
        currentSession.terminate();
        currentSession = null;
        resetCallUI();
      }
    });
}
// Показ и скрытие истории звонков
document
  .getElementById("toggle-history-button")
  .addEventListener("click", function () {
    const historyElement = document.getElementById("call-history");
    const isVisible = historyElement.style.display !== "none";
    historyElement.style.display = isVisible ? "none" : "block";
    this.textContent = isVisible
      ? "Показать историю звонков"
      : "Скрыть историю звонков";
    showCallHistory();
  });

// Выход
document.getElementById("logout-button").addEventListener("click", function () {
  if (ua) {
    ua.stop();
    ua = null;
  }
  // Очистка данныых пользователя
  chrome.storage.local.remove(["login", "server", "password"], function () {
    updateCallStatus("Неактивен");
    document.getElementById("login-form").style.display = "block";
    document.getElementById("logout-button").style.display = "none";
    resetCallUI();
  });
});
document.getElementById("login-button").addEventListener("click", function () {
  const server = document.getElementById("server").value;
  const login = document.getElementById("login").value;
  const password = document.getElementById("password").value;
  attemptLogin(server, login, password);
});

setupEndCallButton();
