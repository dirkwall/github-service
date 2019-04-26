apiVersion: extensions/v1beta1
kind: Deployment
metadata:
  name: SERVICE_PLACEHOLDER_DEC
  labels:
    app: {{ .Chart.Name }}-selector-SERVICE_PLACEHOLDER_DEC
    chart: "{{ .Chart.Name }}-{{ .Chart.Version }}"
    release: "{{ .Release.Name }}"
    heritage: "{{ .Release.Service }}"
spec:
  replicas: {{ .Values.SERVICE_PLACEHOLDER_C.replicaCount }}
  template:
    metadata:
      labels:
        app: {{ .Chart.Name }}-selector-SERVICE_PLACEHOLDER_DEC
        deployment: SERVICE_PLACEHOLDER_DEC
    spec:
      containers:
      - name: {{ .Values.SERVICE_PLACEHOLDER_C.container.name }}
        image: "{{ .Values.SERVICE_PLACEHOLDER_C.image.repository }}:{{ .Values.SERVICE_PLACEHOLDER_C.image.tag }}"
        imagePullPolicy: {{ .Values.SERVICE_PLACEHOLDER_C.image.pullPolicy }}
        env:
        - name: DT_TAGS
          value: "application={{ .Chart.Name }}"
        - name: KUBERNETES_NAMESPACE
          valueFrom:
            fieldRef:
              fieldPath: "metadata.namespace"
        - name: CONTAINER_IMAGE
          value: "{{ .Values.SERVICE_PLACEHOLDER_C.image.repository }}:{{ .Values.SERVICE_PLACEHOLDER_C.image.tag }}"
        ports:
        - name: internalport
          containerPort: {{ .Values.SERVICE_PLACEHOLDER_C.service.internalPort }}
        resources:
{{ toYaml .Values.resources | indent 12 }}
