# Создать расширение для хром: софтфон со следующим функционалом (18 часов)

Разобраться как работает JS Sip.

- Регистрация пользователя на сервере SIP: расширение должно предоставлять возможность
  пользователю вводить свои SIP-данные (логин, пароль, сервер) для регистрации на сервере.

- Отображение текущего статуса звонка: расширение может отображать иконку или статус в виде
  полоски, показывающей текущий статус звонка (например, “Ожидание”, “В процессе”, “Завершено”).

- Осуществление звонков: пользователь должен иметь возможность инициировать звонки, нажав на
  кнопку или используя горячие клавиши.

- Прием входящих звонков: пользователь должен иметь возможность принимать звонки.

- Сохранение истории звонков: расширение может сохранять историю вызовов, чтобы пользователь
  мог легко просматривать и повторно набирать последние номера.

- Отображение информации о звонке: когда идет вызов, расширение может показывать информацию
  о вызове, такую как продолжительность звонка, имя вызываемого контакта.

## Техническая информация для выполнения задания:

Для тестирования звонка, потребуется две sip учетки. Одна заводится в сип клиента, например
софтфон 3сх (https://www.uiscom.ru/podderzhka/nastrojka-oborudovanija/), а вторая в ваше приложение.
Звонить по сип номерам можно с номера на номер.
