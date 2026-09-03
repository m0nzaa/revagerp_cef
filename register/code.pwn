#define public:%0(%1) forward %0(%1) ; public %0(%1)

cef_emit_event(playerid, "window.event('client.authorization.active')", CEFINT(true or false));

cef_emit_event(playerid, "window.event('client.authorization.page')", CEFINT(/* page id */));

/*

page id:

1 - авторизация
2 - сброс пароля (Введите логин)
3 - сброс пароля (Восстановить через)
4 - сброс пароля (высланы дальнейшие инструкции)
5 - регистрация

*/

cef_emit_event(playerid, "window.event('client.authorization.name')", CEFSTR("Lethality_Studio")); // устанавливает текст в поле ввода для логина

cef_emit_event(playerid, "window.event('client.authorization.notify')", CEFSTR("tg" or "vk" or "mail")); // куда придёт уведомление при восстановлении пароля

cef_subscribe("window.emit('client.bundle.inputs')", "MalinovkaAuthorizationResponse"); // OnGameModeInit

public: MalinovkaAuthorizationResponse(playerid, callback[])
{
    new login[24], password[36];
    sscanf(callback, "s[24]s[36]", login, password);

    SCMf(playerid, -1, "Login: %s, Password: %s", login, password);

    return 1;
}

cef_subscribe("window.emit('client.responce.authorization')", "MalinovkaAuthorization"); // OnGameModeInit

public: MalinovkaAuthorization(playerid, callback[])
{
    new id;
    sscanf(callback, "i", id);

    SCMf(playerid, -1, "ID: %d", id);

    return 1;
}