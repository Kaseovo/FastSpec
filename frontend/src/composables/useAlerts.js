import { ref } from "vue";

export function useAlerts() {
  const alert = ref({ show: false, message: "", type: "info" });

  const showAlert = (message, type = "info") => {
    alert.value = { show: true, message, type };
    setTimeout(() => {
      alert.value.show = false;
    }, 5000);
  };

  const closeAlert = () => {
    alert.value.show = false;
  };

  return { alert, showAlert, closeAlert };
}
