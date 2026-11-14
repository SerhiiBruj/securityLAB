v= 2000
t=92
n=41

vt=v*60*60*24*356*t
vph=(v*60*60*24*356)/2
for i in range(1,41):
    result = pow(41,i)
    if result > vt:
        print(i)
        break

possibility = (vph)/pow(41,8)

print(possibility)