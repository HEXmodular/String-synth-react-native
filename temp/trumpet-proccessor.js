class TrumpetProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'frequency', defaultValue: 440, minValue: 100, maxValue: 2000 },
      { name: 'breathPressure', defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: 'lipTension', defaultValue: 0.5, minValue: 0, maxValue: 1 }
    ];
  }

  constructor() {
    super();
    // Максимальный размер линии задержки (для низких нот)
    this.bufferSize = 44100;
    this.delayBuffer = new Float32Array(this.bufferSize);
    this.writeIndex = 0;
    
    // Переменная для простейшего НЧ-фильтра внутри трубы (потери тепла и трения)
    this.filterState = 0;
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    const channel = output[0]; // Моно-выход

    const freq = parameters['frequency'];
    const breath = parameters['breathPressure'];
    const tension = parameters['lipTension'];

    for (let i = 0; i < channel.length; i++) {
      // Получаем текущие значения параметров для конкретного семпла
      const currentFreq = freq.length > 1 ? freq[i] : freq[0];
      const currentBreath = breath.length > 1 ? breath[i] : breath[0];
      const currentTension = tension.length > 1 ? tension[i] : tension[0];

      // 1. Считаем длину линии задержки в семплах для нужной частоты
      // Для трубы длина волны равна 2 * длина трубы, поэтому делим sampleRate на 2 * freq
      const delaySamples = sampleRate / (currentFreq * 2);

      // 2. Читаем отраженную волну из конца трубы (с обратным знаком, так как раструб инвертирует фазу давления)
      let readIndex = this.writeIndex - delaySamples;
      if (readIndex < 0) readIndex += this.bufferSize;
      
      // Простая линейная интерполяция для плавного изменения частоты без щелчков
      const indexInt = Math.floor(readIndex);
      const indexFrac = readIndex - indexInt;
      const nextIndex = (indexInt + 1) % this.bufferSize;
      
      const reflectedWave = -(this.delayBuffer[indexInt] * (1 - indexFrac) + this.delayBuffer[nextIndex] * indexFrac);

      // 3. Модель губ (нелинейный клапан)
      // Разница давлений во рту и внутри трубы на входе
      const deltaPressure = currentBreath - reflectedWave;
      
      // Функция раскрытия губ: чем выше давление во рту, тем сильнее они открываются,
      // но если давление внутри трубы слишком велико, они прижимаются. Натяжение губ (tension) меняет жесткость.
      let lipOpening = 1.0 - (deltaPressure * (0.3 + currentTension * 0.5));
      if (lipOpening < 0) lipOpening = 0;
      if (lipOpening > 1) lipOpening = 1;

      // Воздушный поток через губы создает новую волну давления
      const breathingSignal = deltaPressure * lipOpening;

      // 4. Суммируем сигнал дыхания и отраженную волну
      let inputToPipe = breathingSignal + reflectedWave * 0.3; 

      // Низкочастотный фильтр в петле обратной связи (имитирует затухание ВЧ в теле трубы)
      this.filterState = 0.7 * this.filterState + 0.3 * inputToPipe;

      // Записываем в волновод
      this.delayBuffer[this.writeIndex] = this.filterState;

      // 5. Выход наружу (звук раструба)
      // Раструб работает как фильтр верхних частот: пропускает то, что НЕ отразилось обратно
      channel[i] = breathingSignal - reflectedWave;

      // Инкремент указателя записи
      this.writeIndex = (this.writeIndex + 1) % this.bufferSize;
    }

    return true;
  }
}

registerProcessor('trumpet-processor', TrumpetProcessor);