' launch-musedesk.vbs — Démarre MuseDesk : serveur statique local (caché) + navigateur
' Double-clic depuis le raccourci bureau.
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "C:\Dev\musedesk"

' Démarre le serveur HTTP en arrière-plan, fenêtre cachée (0).
' (Si le port est déjà pris, python s'arrête silencieusement — sans gêne.)
sh.Run "python -m http.server 8000", 0, False

' Laisse le serveur démarrer, puis ouvre l'app dans le navigateur par défaut.
WScript.Sleep 1200
sh.Run "http://localhost:8000/index.html", 1, False
