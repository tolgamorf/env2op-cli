Output env2op-demo.gif

Set FontSize 20
Set Width 1200
Set Height 700
Set Theme "Monokai Pro"
Set TypingSpeed 95ms

Type "env2op .env 'tolgamorf' 'my-app .env' --yes"
Sleep 500ms
Enter
Sleep 17s

Type "cat .env.tpl"
Sleep 500ms
Enter
Sleep 5s

Type "clear"
Sleep 300ms
Enter
Sleep 1s

Type "op inject -i .env.tpl -o .env.local"
Sleep 500ms
Enter
Sleep 17s

Type "cat .env.tpl"
Sleep 500ms
Enter
Sleep 5s
