job "aglu.pl" {
  datacenters = ["dc1"]
  type = "service"

  group "podman" {
    count = 1

    constraint {
      attribute = "${attr.driver.podman.version}"
      operator  = "is_set"
    }

    network {
      port "http" {
        static = 8987
      }
    }

    task "nginx" {
      driver = "podman"

      config {
        image = "ghcr.io/kukaraf/aglu.pl:latest"
        ports = ["http"]
      }

      resources {
        cpu    = 500
        memory = 256
      }
    }
  }
}
