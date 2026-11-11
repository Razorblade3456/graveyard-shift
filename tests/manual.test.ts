import {test} from 'node:test';
import assert from 'node:assert/strict';
import {changeProfile,clock,initialState} from '../src/core.ts';
test('duplicate native arrival respects manual departure until next boundary',()=>{const at=Date.now()-100000;let s=clock(changeProfile(initialState(),'default',p=>({...p,automation:true})),'in','auto',at,'region:in');s=clock(s,'out','manual',at+1000);assert.equal(clock(s,'in','auto',at+2000,'region:in'),s);s=clock(s,'out','auto',at+3000,'region:out');s=clock(s,'in','auto',at+4000,'region:in');assert.equal(s.shifts.length,2);});
