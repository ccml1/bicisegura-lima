# Burndown por sprint (ideal vs. real) y velocidad. Simulación: 1 sprint = 1 semana (lunes a domingo).
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':10})
DIAS=['Lun','Mar','Mié','Jue','Vie','Sáb','Dom','Cierre']
# puntos completados por día (índice 0..7), según el orden en que las HU pasaron a Listo en Jira
SPRINTS=[
 ('Sprint 1 · 23–29 nov','Plataforma base y mapa',21,{1:3,3:5,5:5,7:8}),
 ('Sprint 2 · 30 nov–6 dic','Reportes y validación',21,{2:5,4:8,6:5,7:3}),
 ('Sprint 3 · 7–13 dic','Estadísticas y riesgo',21,{2:5,3:5,6:8,7:3}),
 ('Sprint 4 · 14–20 dic','Ciclovías y estacionamientos',20,{4:2,6:5}),
]
fig,axs=plt.subplots(2,2,figsize=(11,7),dpi=180,sharey=True)
for ax,(nombre,obj,total,hechos) in zip(axs.flat,SPRINTS):
    ideal=[total-total*i/7 for i in range(8)]
    real=[]; rest=total
    for i in range(8): rest-=hechos.get(i,0); real.append(rest)
    ax.plot(range(8),ideal,color='#8a8984',lw=2,ls=(0,(5,4)),label='Ideal')
    ax.step(range(8),real,where='post',color='#d6322b',lw=2.2,label='Real')
    ax.plot(range(8),real,'o',color='#d6322b',ms=4)
    ax.set_title(f'{nombre}\n{obj}',loc='left',fontsize=10,color='#1c1c1e')
    ax.set_xticks(range(8),DIAS,fontsize=8); ax.set_ylim(0,23)
    comp=total-real[-1]
    ax.text(6.9,max(real[-1],1.2)+0.6,f'{comp}/{total} pts',ha='right',fontsize=9,color='#d6322b',fontweight='bold')
    for s in ['top','right']: ax.spines[s].set_visible(False)
    ax.grid(axis='y',color='#e6e5e0',lw=.8); ax.set_axisbelow(True)
for ax in axs[:,0]: ax.set_ylabel('Story points restantes')
axs[0,0].legend(frameon=False,loc='upper right')
fig.suptitle('Burndown por sprint (simulación) · ideal vs. real',x=0.01,ha='left',fontsize=13,fontweight='bold')
fig.tight_layout(); fig.savefig('burndown-sprints.png')

fig,ax=plt.subplots(figsize=(8,4),dpi=180)
names=['Sprint 1','Sprint 2','Sprint 3','Sprint 4']; comp=[21,21,21,7]; compr=[21,21,21,20]
import numpy as np; x=np.arange(4); w=0.36
ax.bar(x-w/2,compr,w,color='#b8c0cc',label='Comprometido')
ax.bar(x+w/2,comp,w,color='#0a84ff',label='Completado')
for i,(a,b) in enumerate(zip(compr,comp)):
    ax.text(i-w/2,a+0.4,a,ha='center',fontsize=9,color='#52514e'); ax.text(i+w/2,b+0.4,b,ha='center',fontsize=9,fontweight='bold')
prom=sum(comp)/4; ax.axhline(prom,color='#d6322b',ls='--',lw=1.2); ax.text(3.45,prom+0.5,f'Velocidad promedio {prom:.1f}',ha='right',color='#d6322b',fontsize=9)
ax.set_xticks(x,names); ax.set_ylabel('Story points'); ax.set_ylim(0,25)
for s in ['top','right']: ax.spines[s].set_visible(False)
ax.legend(frameon=False,loc='upper left',ncol=2); ax.set_title('Velocidad del equipo por sprint',loc='left',fontweight='bold')
fig.tight_layout(); fig.savefig('velocidad.png')
