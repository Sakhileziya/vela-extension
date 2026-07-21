import { appendEvent, readEvents, streamEvents } from './storage.js';

(async () => {
  try {
    console.log('Appending test event...');
    const rec = await appendEvent({ type: 'test:event', payload: { note: 'storage test' } });
    console.log('Appended:', rec);

    console.log('Reading last 5 events...');
    const events = await readEvents();
    console.log('Total events:', events.length);
    console.log(events.slice(-5));

    console.log('Streaming events (first 5)');
    let count = 0;
    await streamEvents((ev) => {
      if (count < 5) console.log('streamed:', ev);
      count += 1;
    });
    console.log('Streamed total lines:', count);
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  }
})();
