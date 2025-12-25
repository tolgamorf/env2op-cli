Output env2op-demo.gif

Set FontSize 20
Set Width 1200
Set Height 800
Set TypingSpeed 85ms

Type "env2op .env 'tolgamorf' 'my-app .env' --yes" Sleep 400ms Enter
Hide
Sleep 5s
Show
Sleep 14s

Type "cat .env.tpl" Sleep 400ms Enter
Sleep 6s

Type "clear" Sleep 300ms Enter
Sleep 1s

Type "op inject -i .env.tpl -o .env.local > /dev/null"
Sleep 400ms
Enter
Sleep 4s

Type "cat .env.local" Sleep 400ms Enter
Sleep 8s

Type "clear" Sleep 300ms Enter
Sleep 2s
