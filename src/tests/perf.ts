import {PerformanceObserver, performance} from 'perf_hooks';
import {KSQL} from '../';

const db = new KSQL('test', {memory: true});
db.set(new Map(), new Map([[1, 1]]));

function time(search: any) {
    return new Promise<number>(resolve => {
        const wrapped = performance.timerify(db.get.bind(db));

        const obs = new PerformanceObserver((list) => {
            resolve(list.getEntries()[0].duration);
            obs.disconnect();
        });
        obs.observe({ entryTypes: ['function'] });

        // A performance timeline entry will be created
        wrapped(search);
    }).catch(() => {
        console.log({search});
        return null;
    });
}

(async () => {
    function random(num: number) {
        return Math.floor(Math.random() * num);
    }
    const runs = parseInt(process.argv[2]) || 100;
    const times = [];
    let highest = 0;
    let lowest = 0;
    for (let i = 0; i < runs; i++) {
        db.set(i, new Map([[i, i]]));
        const val = await time(random(i));
        if (val === null) continue;
        times.push(val);
        if (val > highest) highest = val;
        if (val < lowest) lowest = val;
    }
    console.log(
        `For ${runs} runs, the average time was ` +
        `${(times.reduce((a, b) => a + b) / runs).toFixed(2)}ms ` + 
        `with a maximum of ${highest.toFixed(2)}ms and a minimum of ` +
        `${lowest}ms.`
    );
})();