import Swal from 'sweetalert2';

// Configuração global do SweetAlert2 para garantir ícones consistentes
export const configureSweetAlert = () => {
  // Configurações padrão para todos os alerts
  const defaultOptions = {
    customClass: {
      confirmButton: 'swal2-confirm',
      cancelButton: 'swal2-cancel',
    },
    buttonsStyling: false,
    reverseButtons: false,
    focusConfirm: true,
    allowOutsideClick: false,
    allowEscapeKey: true,
    showClass: {
      popup: 'swal2-show',
      icon: 'swal2-icon-show'
    },
    hideClass: {
      popup: 'swal2-hide',
      icon: 'swal2-icon-hide'
    }
  };

  // Aplicar configurações padrão
  Swal.mixin(defaultOptions);

  return Swal;
};

// Função helper para criar alerts padronizados
export const showAlert = {
  success: (title: string, text?: string) => {
    return Swal.fire({
      title,
      text,
      icon: 'success',
      confirmButtonColor: '#10b981',
    });
  },
  
  error: (title: string, text?: string) => {
    return Swal.fire({
      title,
      text,
      icon: 'error',
      confirmButtonColor: '#10b981',
    });
  },
  
  warning: (title: string, text?: string, options?: any) => {
    return Swal.fire({
      title,
      text,
      icon: 'warning',
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#6b7280',
      ...options,
    });
  },
  
  info: (title: string, text?: string) => {
    return Swal.fire({
      title,
      text,
      icon: 'info',
      confirmButtonColor: '#10b981',
    });
  },
  
  confirm: (title: string, text: string, confirmText = 'Confirmar', cancelText = 'Cancelar') => {
    return Swal.fire({
      title,
      text,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#6b7280',
      confirmButtonText: confirmText,
      cancelButtonText: cancelText,
    });
  }
};
